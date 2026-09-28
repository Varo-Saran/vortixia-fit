import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const modelSource = await readFile(
  path.join(root, "src/lib/routine-model.ts"),
  "utf8",
);
const migrationSource = await readFile(
  path.join(
    root,
    "supabase/migrations/20260928090000_routine_data_model_foundation.sql",
  ),
  "utf8",
);
const routineStoreSource = await readFile(
  path.join(root, "src/store/useRoutineStore.ts"),
  "utf8",
);
const routineEditorSource = await readFile(
  path.join(root, "src/app/routines/edit/page.tsx"),
  "utf8",
);
const templatesPageSource = await readFile(
  path.join(root, "src/app/routines/templates/page.tsx"),
  "utf8",
);
const routinesPageSource = await readFile(
  path.join(root, "src/app/routines/page.tsx"),
  "utf8",
);

async function readApplicationSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const sources = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      sources.push(...await readApplicationSources(entryPath));
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
      sources.push({
        path: path.relative(root, entryPath),
        source: await readFile(entryPath, "utf8"),
      });
    }
  }
  return sources;
}

const applicationSources = await readApplicationSources(path.join(root, "src"));

function extractConstInitializer(source, constantName, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let initializer = null;

  function visit(node) {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === constantName
      && node.initializer
    ) {
      initializer = node.initializer.getText(sourceFile);
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  if (!initializer) {
    throw new Error(`${constantName} initializer was not found in ${fileName}`);
  }
  return initializer;
}

const transpiledModel = ts.transpileModule(modelSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: "routine-model.ts",
});
const routineModel = await import(
  `data:text/javascript;base64,${Buffer.from(transpiledModel.outputText).toString("base64")}`
);

const predefinedTemplatesInitializer = extractConstInitializer(
  routineStoreSource,
  "PREDEFINED_TEMPLATES",
  "useRoutineStore.ts",
);
const transpiledTemplates = ts.transpileModule(
  `export const PREDEFINED_TEMPLATES = ${predefinedTemplatesInitializer};`,
  {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "routine-templates.ts",
  },
);
const { PREDEFINED_TEMPLATES: predefinedTemplates } = await import(
  `data:text/javascript;base64,${Buffer.from(transpiledTemplates.outputText).toString("base64")}`
);

const failures = [];
let assertions = 0;
const addedAssertionCounts = {
  privilegeState: 0,
  firstDmlOrder: 0,
  selfTests: 0,
};

function assert(condition, message) {
  assertions += 1;
  if (!condition) failures.push(message);
}

function assertEqual(actual, expected, message) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function assertThrows(callback, message) {
  let threw = false;
  try {
    callback();
  } catch {
    threw = true;
  }
  assert(threw, message);
}

function assertAdded(category, condition, message) {
  addedAssertionCounts[category] += 1;
  assert(condition, message);
}

function splitSqlList(value) {
  const entries = [];
  let current = "";
  let depth = 0;

  for (const character of value) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;

    if (character === "," && depth === 0) {
      entries.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  if (current.trim()) entries.push(current.trim());
  return entries;
}

function splitTopLevelSqlStatements(source) {
  const statements = [];
  let current = "";
  let index = 0;
  let state = "normal";
  let dollarTag = null;

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    if (state === "line-comment") {
      if (character === "\n") {
        current += "\n";
        state = "normal";
      }
      index += 1;
      continue;
    }

    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        current += " ";
        state = "normal";
        index += 2;
      } else {
        if (character === "\n") current += "\n";
        index += 1;
      }
      continue;
    }

    if (state === "single-quote") {
      current += character;
      if (character === "'" && next === "'") {
        current += next;
        index += 2;
      } else {
        if (character === "'") state = "normal";
        index += 1;
      }
      continue;
    }

    if (state === "double-quote") {
      current += character;
      if (character === '"' && next === '"') {
        current += next;
        index += 2;
      } else {
        if (character === '"') state = "normal";
        index += 1;
      }
      continue;
    }

    if (state === "dollar-quote") {
      if (source.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length;
        dollarTag = null;
        state = "normal";
      } else {
        current += character;
        index += 1;
      }
      continue;
    }

    if (character === "-" && next === "-") {
      current += " ";
      state = "line-comment";
      index += 2;
      continue;
    }
    if (character === "/" && next === "*") {
      current += " ";
      state = "block-comment";
      index += 2;
      continue;
    }
    if (character === "'") {
      current += character;
      state = "single-quote";
      index += 1;
      continue;
    }
    if (character === '"') {
      current += character;
      state = "double-quote";
      index += 1;
      continue;
    }
    if (character === "$") {
      const tagMatch = source.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (tagMatch) {
        dollarTag = tagMatch[0];
        current += dollarTag;
        index += dollarTag.length;
        state = "dollar-quote";
        continue;
      }
    }
    if (character === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      index += 1;
      continue;
    }

    current += character;
    index += 1;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

function normalizeSqlObjectName(value, kind) {
  const normalized = value
    .replace(/"/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (kind === "function") {
    return normalized.replace(/\s*\(\s*/g, "(").replace(/\s*\)\s*/g, ")");
  }
  return normalized;
}

const routineTables = [
  "public.routines",
  "public.routine_days",
  "public.planned_exercises",
];
const routineRoles = ["public", "anon", "authenticated"];
const tablePrivileges = [
  "select",
  "insert",
  "update",
  "delete",
  "truncate",
  "references",
  "trigger",
];
const routineSaveFunction = "public.save_active_routine_v1(jsonb)";

function createPrivilegeState() {
  const tables = new Map();
  for (const table of routineTables) {
    const roles = new Map();
    for (const role of routineRoles) {
      // Start from a conservative unknown/preexisting state. The migration's
      // REVOKE statements must clear every tracked privilege explicitly.
      roles.set(role, new Set(tablePrivileges));
    }
    tables.set(table, roles);
  }

  const functions = new Map([
    [
      routineSaveFunction,
      new Map(routineRoles.map((role) => [role, new Set()])),
    ],
  ]);
  return { tables, functions };
}

function applyPrivilegeStatement(state, statement, parseErrors) {
  const normalized = statement.replace(/\s+/g, " ").trim();
  const match = normalized.match(
    /^(grant|revoke)\s+(.+?)\s+on\s+(table|function)\s+(.+?)\s+(to|from)\s+(.+)$/i,
  );

  if (!match) {
    if (
      /^(?:grant|revoke)\b/i.test(normalized) &&
      /(?:public\.(?:routines|routine_days|planned_exercises)|public\.save_active_routine_v1)/i.test(normalized)
    ) {
      parseErrors.push(`Could not parse relevant privilege statement: ${normalized}`);
    }
    return;
  }

  const [, operationRaw, privilegesRaw, kindRaw, objectsRaw, directionRaw, rolesRaw] = match;
  const operation = operationRaw.toLowerCase();
  const kind = kindRaw.toLowerCase();
  if ((operation === "grant" && directionRaw.toLowerCase() !== "to") ||
      (operation === "revoke" && directionRaw.toLowerCase() !== "from")) {
    parseErrors.push(`Invalid GRANT/REVOKE direction: ${normalized}`);
    return;
  }

  const supportedPrivileges = kind === "table" ? tablePrivileges : ["execute"];
  const privilegeText = privilegesRaw.trim().toLowerCase();
  const privileges = /^(?:all|all privileges)$/.test(privilegeText)
    ? supportedPrivileges
    : splitSqlList(privilegesRaw).map((privilege) => privilege.trim().toLowerCase());
  const roles = splitSqlList(rolesRaw).map((role) => role.replace(/"/g, "").trim().toLowerCase());
  const objects = splitSqlList(objectsRaw).map((object) => normalizeSqlObjectName(object, kind));
  const relevantObjects = kind === "table" ? routineTables : [routineSaveFunction];
  const targetState = kind === "table" ? state.tables : state.functions;

  for (const object of objects) {
    if (!relevantObjects.includes(object)) continue;
    for (const role of roles) {
      if (!routineRoles.includes(role)) continue;
      const roleState = targetState.get(object).get(role);
      for (const privilege of privileges) {
        if (!supportedPrivileges.includes(privilege)) {
          parseErrors.push(`Unsupported ${kind} privilege ${privilege} in: ${normalized}`);
          continue;
        }
        if (operation === "grant") roleState.add(privilege);
        else roleState.delete(privilege);
      }
    }
  }
}

function evaluateFinalPrivileges(source) {
  const state = createPrivilegeState();
  const parseErrors = [];
  let functionCreateIndex = -1;
  const statements = splitTopLevelSqlStatements(source);

  for (const [statementIndex, statement] of statements.entries()) {
    if (
      /^create\s+or\s+replace\s+function\s+public\.save_active_routine_v1\s*\(\s*p_routine\s+jsonb\s*\)/i
        .test(statement)
    ) {
      functionCreateIndex = statementIndex;
      // A newly created PostgreSQL function has PUBLIC EXECUTE by default.
      // Setting it here also makes a pre-CREATE revoke insufficient.
      state.functions.get(routineSaveFunction).get("public").add("execute");
    }
    applyPrivilegeStatement(state, statement, parseErrors);
  }

  return { state, parseErrors, functionCreateIndex };
}

function privilegeViolations(source) {
  const evaluation = evaluateFinalPrivileges(source);
  const violations = [...evaluation.parseErrors];
  if (evaluation.functionCreateIndex < 0) {
    violations.push("Routine save function creation was not found");
  }

  for (const table of routineTables) {
    for (const role of routineRoles) {
      const actual = [...evaluation.state.tables.get(table).get(role)].sort();
      const expected = role === "authenticated" ? ["select"] : [];
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        violations.push(`${role} final privileges on ${table}: ${actual.join(", ") || "none"}`);
      }
    }
  }

  for (const role of routineRoles) {
    const actual = [...evaluation.state.functions.get(routineSaveFunction).get(role)].sort();
    const expected = role === "authenticated" ? ["execute"] : [];
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      violations.push(`${role} final privileges on ${routineSaveFunction}: ${actual.join(", ") || "none"}`);
    }
  }

  return { ...evaluation, violations };
}

function extractRoutineSaveFunction(source) {
  const signature = /create\s+or\s+replace\s+function\s+public\.save_active_routine_v1\s*\(\s*p_routine\s+jsonb\s*\)/i;
  const signatureMatch = signature.exec(source);
  if (!signatureMatch) throw new Error("Routine save function signature was not found");

  const afterSignature = signatureMatch.index + signatureMatch[0].length;
  const bodyOpeningMatch = /\bas\s+(\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)/i.exec(
    source.slice(afterSignature),
  );
  if (!bodyOpeningMatch) throw new Error("Routine save function body delimiter was not found");

  const delimiter = bodyOpeningMatch[1];
  const bodyStart = afterSignature + bodyOpeningMatch.index + bodyOpeningMatch[0].length;
  const bodyEnd = source.indexOf(delimiter, bodyStart);
  if (bodyEnd < 0) throw new Error("Routine save function closing delimiter was not found");

  return {
    body: source.slice(bodyStart, bodyEnd),
    bodyStart,
    bodyEnd,
    definition: source.slice(signatureMatch.index, bodyEnd + delimiter.length),
  };
}

function maskSqlCommentsAndStrings(source, { maskStrings }) {
  let result = "";
  let index = 0;
  let state = "normal";

  const masked = (character) => (character === "\n" || character === "\r" ? character : " ");

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    if (state === "line-comment") {
      result += masked(character);
      if (character === "\n") state = "normal";
      index += 1;
      continue;
    }
    if (state === "block-comment") {
      result += masked(character);
      if (character === "*" && next === "/") {
        result += " ";
        index += 2;
        state = "normal";
      } else {
        index += 1;
      }
      continue;
    }
    if (state === "single-quote") {
      result += maskStrings ? masked(character) : character;
      if (character === "'" && next === "'") {
        result += maskStrings ? " " : next;
        index += 2;
      } else {
        if (character === "'") state = "normal";
        index += 1;
      }
      continue;
    }
    if (state === "double-quote") {
      result += maskStrings ? masked(character) : character;
      if (character === '"' && next === '"') {
        result += maskStrings ? " " : next;
        index += 2;
      } else {
        if (character === '"') state = "normal";
        index += 1;
      }
      continue;
    }

    if (character === "-" && next === "-") {
      result += "  ";
      index += 2;
      state = "line-comment";
      continue;
    }
    if (character === "/" && next === "*") {
      result += "  ";
      index += 2;
      state = "block-comment";
      continue;
    }
    if (character === "'") {
      result += maskStrings ? " " : character;
      index += 1;
      state = "single-quote";
      continue;
    }
    if (character === '"') {
      result += maskStrings ? " " : character;
      index += 1;
      state = "double-quote";
      continue;
    }

    result += character;
    index += 1;
  }

  return result;
}

function findFirstDml(functionBody) {
  const executableSource = maskSqlCommentsAndStrings(functionBody, { maskStrings: true });
  const pattern = /(?:^|;|\bbegin\b|\bthen\b|\belse\b|\bloop\b)\s*(update\b|insert\s+into\b|delete\s+from\b|merge\s+into\b)/gim;
  const match = pattern.exec(executableSource);
  if (!match) return null;

  const keyword = match[1].replace(/\s+/g, " ").toLowerCase();
  const relativeIndex = match[0].toLowerCase().lastIndexOf(match[1].toLowerCase());
  const index = match.index + relativeIndex;
  return {
    index,
    keyword,
    excerpt: executableSource.slice(index, index + 120).replace(/\s+/g, " ").trim(),
  };
}

const requiredPreDmlMarkers = [
  ["auth.uid() identity", /v_user_id\s+uuid\s*:=\s*auth\.uid\(\)/i],
  ["unauthenticated rejection", /if\s+v_user_id\s+is\s+null\s+then/i],
  ["payload ownership rejection", /p_routine\s*\?\s*'user_id'/i],
  ["top-level object validation", /jsonb_typeof\(p_routine\)\s*<>\s*'object'/i],
  ["routine name validation", /char_length\(v_routine_name\)\s+not\s+between\s+1\s+and\s+80/i],
  ["exactly seven days", /jsonb_array_length\(v_days\)\s*<>\s*7/i],
  ["weekday uniqueness", /v_weekday\s*=\s*any\(v_seen_weekdays\)/i],
  ["day UUID uniqueness", /v_day_id\s*=\s*any\(v_seen_day_ids\)/i],
  ["day title and kind validation", /char_length\(v_title\)\s+not\s+between\s+1\s+and\s+60[\s\S]*v_kind\s+not\s+in/i],
  ["rest-day emptiness", /v_kind\s*=\s*'rest'\s+and\s+v_exercise_count\s*>\s*0/i],
  ["occurrence field type validation", /jsonb_typeof\(v_exercise\s*->\s*'id'\)[\s\S]*jsonb_typeof\(v_exercise\s*->\s*'order'\)/i],
  ["occurrence UUID uniqueness", /v_occurrence_id\s*=\s*any\(v_seen_occurrence_ids\)/i],
  ["occurrence value validation", /v_target_sets\s*<\s*1[\s\S]*v_weight_unit\s+not\s+in[\s\S]*v_rest_seconds\s+is\s+not\s+null/i],
  ["contiguous occurrence order", /for\s+v_index\s+in\s+0\.\.\(v_exercise_count\s*-\s*1\)[\s\S]*v_index\s*=\s*any\(v_seen_orders\)/i],
  ["routine UUID preflight", /select\s+routine\.user_id[\s\S]*from\s+public\.routines\s+as\s+routine/i],
  ["day UUID preflight", /from\s+public\.routine_days\s+as\s+routine_day[\s\S]*routine_day\.id\s*=\s*any\(v_seen_day_ids\)/i],
  ["occurrence UUID preflight", /from\s+public\.planned_exercises\s+as\s+planned_exercise[\s\S]*planned_exercise\.id\s*=\s*any\(v_seen_occurrence_ids\)/i],
];

function preDmlViolations(source) {
  const extracted = extractRoutineSaveFunction(source);
  const functionBody = maskSqlCommentsAndStrings(extracted.body, { maskStrings: false });
  const firstDml = findFirstDml(extracted.body);
  const violations = [];

  if (!firstDml) {
    violations.push("No DML statement was found in the routine save function");
    return { extracted, firstDml, markers: [], violations };
  }

  const markers = requiredPreDmlMarkers.map(([label, pattern]) => {
    const match = pattern.exec(functionBody);
    const index = match?.index ?? -1;
    const endIndex = match ? match.index + match[0].length : -1;
    if (index < 0) violations.push(`${label} was not found in executable function structure`);
    else if (endIndex > firstDml.index) violations.push(`${label} is not complete before the first DML statement`);
    return { label, index, endIndex };
  });

  if (!/^update\s+public\.routines\s+set\s+is_active\s*=\s*false/i.test(firstDml.excerpt)) {
    violations.push(`Unexpected first DML statement: ${firstDml.excerpt}`);
  }

  return { extracted, firstDml, markers, violations };
}

function injectAtFunctionBodyStart(source, injection) {
  const extracted = extractRoutineSaveFunction(source);
  const mainBeginMatch = /\bbegin\b/i.exec(extracted.body);
  if (!mainBeginMatch) throw new Error("Routine save function BEGIN was not found");
  const insertionIndex = extracted.bodyStart + mainBeginMatch.index + mainBeginMatch[0].length;
  return `${source.slice(0, insertionIndex)}\n${injection}\n${source.slice(insertionIndex)}`;
}

const weekdayLabels = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const legacyPlan = weekdayLabels.map((day, index) => ({
  day,
  shortDay: day[0],
  type: index === 0 ? "Training" : "Rest",
  title: index === 0 ? "Chest + Back" : "Rest",
  warmups: [],
  mainLifts: index === 0
    ? [
        {
          id: "legacy-a",
          exerciseId: "0025",
          name: "Bench Press",
          targetMuscle: "chest",
          trackingType: "reps_weight",
          weightUnit: "kg",
          targetSets: 3,
          targetValue: "8-10",
        },
        {
          id: "legacy-b",
          exerciseId: "0025",
          name: "Bench Press",
          targetMuscle: "chest",
          trackingType: "reps_weight",
          weightUnit: "lbs",
          targetSets: 4,
          targetValue: "10-12",
        },
        {
          id: "legacy-c",
          exerciseId: null,
          name: "Timed Carry",
          targetMuscle: "full body",
          trackingType: "time_weight",
          weightUnit: "plates",
          targetSets: 2,
          targetValue: "60 secs",
        },
        {
          id: "legacy-d",
          exerciseId: null,
          name: "Plank",
          targetMuscle: "core",
          trackingType: "time_only",
          weightUnit: "unitless",
          targetSets: 2,
          targetValue: "60 secs",
        },
      ]
    : [],
}));

const routine = routineModel.legacyPlanToRoutinePlan(
  "  Push/Pull – 強さ  ",
  legacyPlan,
);
assertEqual(routine.name, "Push/Pull – 強さ", "Routine names are trimmed and preserve Unicode/punctuation");
assertEqual(routine.days.length, 7, "Routine has seven fixed weekdays");
assertEqual(routine.days[0].weekday, "monday", "Weekday identity is normalized");
assertEqual(routine.days[0].title, "Chest + Back", "Day title is independent from weekday");
assertEqual(routine.days[0].kind, "training", "Training day kind is retained");
assertEqual(routine.days[1].kind, "rest", "Rest day kind is retained");
assertEqual(routineModel.validateRoutinePlan(routine), [], "Generated routine validates");

assertEqual(routineModel.normalizeRoutineName(" Chest + Back "), "Chest + Back", "Routine name trimming");
assertEqual(routineModel.normalizeRoutineName("Arms & Shoulders"), "Arms & Shoulders", "Ampersand routine name");
assertThrows(() => routineModel.normalizeRoutineName("   "), "Empty routine name is rejected");
assertThrows(
  () => routineModel.normalizeRoutineName("x".repeat(81)),
  "Routine name over 80 characters is rejected",
);

const monday = routine.days[0];
assert(
  monday.exercises[0].id !== monday.exercises[1].id,
  "Repeated catalog exercise receives distinct occurrence UUIDs",
);
assertEqual(
  [monday.exercises[0].exerciseId, monday.exercises[1].exerciseId],
  ["0025", "0025"],
  "Repeated catalog exercise retains the same catalog identity",
);

const editedRoutine = {
  ...routine,
  days: routine.days.map((day) =>
    day.weekday === "monday"
      ? {
          ...day,
          exercises: day.exercises.map((exercise, index) => ({
            ...exercise,
            targetSets: index === 0 ? 4 : exercise.targetSets,
            targetValue: index === 0 ? "10-12" : exercise.targetValue,
            restSeconds: [null, 60, 90, 75][index],
          })),
        }
      : day,
  ),
};
assertEqual(routineModel.validateRoutinePlan(editedRoutine), [], "Edited sets, targets, units, and rest validate");
assertEqual(
  editedRoutine.days[0].exercises.map((exercise) => exercise.weightUnit),
  ["kg", "lbs", "plates", "unitless"],
  "All supported weight units remain represented",
);

for (const validRest of [null, 60, 90, 120, 75]) {
  let valid = true;
  try {
    routineModel.validateOptionalRestSeconds(validRest);
  } catch {
    valid = false;
  }
  assert(valid, `Rest value ${validRest} is valid`);
}
for (const invalidRest of [0, -1, 3601, 1.5]) {
  assertThrows(
    () => routineModel.validateOptionalRestSeconds(invalidRest),
    `Rest value ${invalidRest} is rejected`,
  );
}
assertEqual(routineModel.effectiveRestSeconds(null, 90), 90, "Null rest uses global default");
assertEqual(routineModel.effectiveRestSeconds(75, 90), 75, "Exercise rest overrides global default");

const reordered = routineModel.reorderOccurrences(
  monday.exercises.slice(0, 3),
  [monday.exercises[2].id, monday.exercises[0].id, monday.exercises[1].id],
);
assertEqual(
  reordered.map((exercise) => exercise.name),
  ["Timed Carry", "Bench Press", "Bench Press"],
  "A B C reorders to C A B",
);
assertEqual(reordered.map((exercise) => exercise.order), [0, 1, 2], "Reorder produces contiguous order values");
assertEqual(reordered[0].trackingType, "time_weight", "Reorder keeps configuration attached to occurrence");

function persistenceRowsFromPayload(rpcPayload) {
  return {
    routine: { id: rpcPayload.id, name: rpcPayload.name },
    days: rpcPayload.days.map((day) => ({
      id: day.id,
      routine_id: rpcPayload.id,
      day_name: routineModel.weekdayLabel(day.weekday),
      type: day.kind,
      title: day.title,
    })),
    exercises: rpcPayload.days.flatMap((day) =>
      day.exercises.map((exercise) => ({
        id: exercise.id,
        routine_day_id: day.id,
        exercise_id: exercise.exercise_id,
        name: exercise.name,
        type: exercise.target_muscle,
        tracking_style: exercise.tracking_type,
        weight_unit: exercise.weight_unit,
        target_sets: exercise.target_sets,
        target_reps: exercise.target_value,
        rest_seconds: exercise.rest_seconds,
        note: exercise.note,
        is_warmup: exercise.section === "warmup",
        order_index: exercise.order,
      })),
    ),
  };
}

function meaningfulRoutineFields(value, { includeOccurrenceIds = true } = {}) {
  return {
    name: value.name,
    days: value.days.map((day) => ({
      weekday: day.weekday,
      title: day.title,
      kind: day.kind,
      exercises: [...day.exercises]
        .sort((left, right) => left.order - right.order)
        .map((exercise) => ({
          ...(includeOccurrenceIds ? { id: exercise.id } : {}),
          exerciseId: exercise.exerciseId,
          name: exercise.name,
          targetMuscle: exercise.targetMuscle,
          section: exercise.section,
          order: exercise.order,
          targetSets: exercise.targetSets,
          targetValue: exercise.targetValue,
          trackingType: exercise.trackingType,
          weightUnit: exercise.weightUnit,
          restSeconds: exercise.restSeconds,
          note: exercise.note ?? null,
        })),
    })),
  };
}

const payload = routineModel.routinePlanToRpcPayload(editedRoutine);
const rows = persistenceRowsFromPayload(payload);
const roundTripped = routineModel.routinePlanFromRows(rows);
assertEqual(roundTripped, routineModel.prepareRoutinePlanForSave(editedRoutine), "Domain/database round trip is lossless");

const legacyRoundTrip = routineModel.legacyPlanToRoutinePlan(
  "Imported Routine",
  routineModel.routinePlanToLegacyPlan(editedRoutine),
);
assertEqual(
  legacyRoundTrip.days[0].exercises.map((exercise) => exercise.restSeconds),
  [null, 60, 90, 75],
  "Temporary legacy adapters preserve per-exercise rest overrides",
);

const intermediateTemplate = predefinedTemplates.find(
  (template) => template.id === "tpl_int_ppl_5",
);
assert(
  intermediateTemplate !== undefined,
  "Repository templates include Intermediate Split (5-Day)",
);

const intermediateRoutine = routineModel.legacyPlanToRoutinePlan(
  intermediateTemplate.name,
  intermediateTemplate.plan,
  editedRoutine.id,
);
assertEqual(
  intermediateRoutine.id,
  editedRoutine.id,
  "Applying a template reuses the current routine root UUID",
);
assertEqual(
  intermediateRoutine.name,
  "Intermediate Split (5-Day)",
  "Applying a template replaces the working routine name",
);
assertEqual(
  intermediateRoutine.days.map((day) => [day.weekday, day.title, day.kind]),
  [
    ["monday", "Chest & Triceps", "training"],
    ["tuesday", "Back & Biceps", "training"],
    ["wednesday", "Cardio, Core & Glute Activation", "training"],
    ["thursday", "Legs, Hamstrings & Glutes", "training"],
    ["friday", "Shoulders, Biceps & Triceps", "training"],
    ["saturday", "Active Recovery", "recovery"],
    ["sunday", "Full Rest", "rest"],
  ],
  "Intermediate Split converts to the approved seven-day kind/title structure",
);

const sourceExerciseNames = intermediateTemplate.plan.flatMap((day) => [
  ...day.warmups.map((exercise) => exercise.name),
  ...day.mainLifts.map((exercise) => exercise.name),
]);
const convertedExerciseNames = intermediateRoutine.days.flatMap((day) =>
  [...day.exercises]
    .sort((left, right) => left.order - right.order)
    .map((exercise) => exercise.name),
);
assertEqual(
  convertedExerciseNames,
  sourceExerciseNames,
  "Template application replaces the old graph without mixing old exercises",
);
const convertedOccurrences = intermediateRoutine.days.flatMap(
  (day) => day.exercises,
);

const sourceExerciseConfiguration = intermediateTemplate.plan.flatMap((day) => [
  ...day.warmups.map((exercise, order) => ({
    name: exercise.name,
    targetMuscle: exercise.targetMuscle,
    section: "warmup",
    order,
    targetSets: exercise.targetSets,
    targetValue: exercise.targetValue,
    trackingType: exercise.trackingType,
    weightUnit: exercise.weightUnit,
    restSeconds: null,
    note: exercise.note ?? null,
  })),
  ...day.mainLifts.map((exercise, index) => ({
    name: exercise.name,
    targetMuscle: exercise.targetMuscle,
    section: "main",
    order: day.warmups.length + index,
    targetSets: exercise.targetSets,
    targetValue: exercise.targetValue,
    trackingType: exercise.trackingType,
    weightUnit: exercise.weightUnit,
    restSeconds: null,
    note: exercise.note ?? null,
  })),
]);
assertEqual(
  convertedOccurrences.map((exercise) => ({
    name: exercise.name,
    targetMuscle: exercise.targetMuscle,
    section: exercise.section,
    order: exercise.order,
    targetSets: exercise.targetSets,
    targetValue: exercise.targetValue,
    trackingType: exercise.trackingType,
    weightUnit: exercise.weightUnit,
    restSeconds: exercise.restSeconds,
    note: exercise.note ?? null,
  })),
  sourceExerciseConfiguration,
  "Intermediate conversion preserves section, order, targets, tracking, units, notes, and default rest",
);

const legacyOccurrenceIds = new Set(
  intermediateTemplate.plan.flatMap((day) => [
    ...day.warmups.map((exercise) => exercise.id),
    ...day.mainLifts.map((exercise) => exercise.id),
  ]),
);
assert(
  convertedOccurrences.every((exercise) => !legacyOccurrenceIds.has(exercise.id)),
  "Legacy template IDs never become routine occurrence UUIDs",
);
assertEqual(
  new Set(convertedOccurrences.map((exercise) => exercise.id)).size,
  convertedOccurrences.length,
  "Every converted template occurrence receives a unique UUID",
);
assert(
  convertedOccurrences.every((exercise) => exercise.exerciseId === null),
  "Unresolved legacy template names do not receive guessed catalog IDs",
);
assert(
  convertedOccurrences.every((exercise) => exercise.restSeconds === null),
  "Legacy template occurrences use the global rest default",
);

const secondIntermediateRoutine = routineModel.legacyPlanToRoutinePlan(
  intermediateTemplate.name,
  intermediateTemplate.plan,
  editedRoutine.id,
);
const firstOccurrenceIds = new Set(convertedOccurrences.map((exercise) => exercise.id));
assert(
  secondIntermediateRoutine.days
    .flatMap((day) => day.exercises)
    .every((exercise) => !firstOccurrenceIds.has(exercise.id)),
  "Repeated template application produces fresh occurrence UUIDs",
);

const saturdayRecovery = intermediateRoutine.days.find(
  (day) => day.weekday === "saturday",
);
const sundayRest = intermediateRoutine.days.find((day) => day.weekday === "sunday");
assertEqual(
  {
    kind: saturdayRecovery.kind,
    title: saturdayRecovery.title,
    exerciseCount: saturdayRecovery.exercises.length,
    names: saturdayRecovery.exercises.map((exercise) => exercise.name),
    orders: saturdayRecovery.exercises.map((exercise) => exercise.order),
  },
  {
    kind: "recovery",
    title: "Active Recovery",
    exerciseCount: 3,
    names: [
      "Treadmill Walk (flat, easy)",
      "Stationary Bike (easy spin)",
      "Full-Body Stretching + Foam Rolling",
    ],
    orders: [0, 1, 2],
  },
  "Legacy Rest-with-exercises Saturday becomes ordered Active Recovery",
);
assertEqual(
  {
    kind: sundayRest.kind,
    title: sundayRest.title,
    exerciseCount: sundayRest.exercises.length,
  },
  { kind: "rest", title: "Full Rest", exerciseCount: 0 },
  "Legacy empty Sunday remains a true rest day",
);
assertEqual(
  routineModel.isDayStartable(saturdayRecovery),
  false,
  "Recovery days remain non-startable",
);

const intermediatePayload = routineModel.routinePlanToRpcPayload(intermediateRoutine);
const persistedIntermediate = routineModel.routinePlanFromRows(
  persistenceRowsFromPayload(intermediatePayload),
);
assertEqual(
  meaningfulRoutineFields(persistedIntermediate),
  meaningfulRoutineFields(routineModel.prepareRoutinePlanForSave(intermediateRoutine)),
  "Intermediate Split survives the persistence payload/row round trip",
);

const exportedIntermediate = routineModel.routinePlanToLegacyPlan(intermediateRoutine);
const importedIntermediate = routineModel.legacyPlanToRoutinePlan(
  intermediateRoutine.name,
  exportedIntermediate,
  intermediateRoutine.id,
);
assertEqual(
  meaningfulRoutineFields(importedIntermediate, { includeOccurrenceIds: false }),
  meaningfulRoutineFields(intermediateRoutine, { includeOccurrenceIds: false }),
  "Current-draft export preserves the meaningful Intermediate Split configuration",
);

const replacementSources = [
  {
    label: "predefined template",
    name: intermediateTemplate.name,
    plan: intermediateTemplate.plan,
  },
  {
    label: "custom template",
    name: "Saved Intermediate Copy",
    plan: exportedIntermediate,
  },
  {
    label: "AI routine",
    name: editedRoutine.name,
    plan: legacyPlan,
  },
  {
    label: "imported routine",
    name: "Imported Routine",
    plan: exportedIntermediate,
  },
  {
    label: "reset routine",
    name: predefinedTemplates[0].name,
    plan: predefinedTemplates[0].plan,
  },
];

for (const replacementSource of replacementSources) {
  const firstReplacement = routineModel.legacyPlanToRoutinePlan(
    replacementSource.name,
    replacementSource.plan,
    editedRoutine.id,
  );
  const secondReplacement = routineModel.legacyPlanToRoutinePlan(
    replacementSource.name,
    replacementSource.plan,
    editedRoutine.id,
  );
  const firstDayIds = new Set(firstReplacement.days.map((day) => day.id));
  const firstExerciseIds = new Set(
    firstReplacement.days.flatMap((day) => day.exercises.map((exercise) => exercise.id)),
  );

  assertEqual(
    firstReplacement.id,
    editedRoutine.id,
    `${replacementSource.label} reuses the verified routine root UUID`,
  );
  assert(
    secondReplacement.days.every((day) => !firstDayIds.has(day.id)),
    `${replacementSource.label} generates fresh day UUIDs on every replacement`,
  );
  assert(
    secondReplacement.days
      .flatMap((day) => day.exercises)
      .every((exercise) => !firstExerciseIds.has(exercise.id)),
    `${replacementSource.label} generates fresh occurrence UUIDs on every replacement`,
  );
  assertEqual(
    firstReplacement.days.flatMap((day) =>
      [...day.exercises]
        .sort((left, right) => left.order - right.order)
        .map((exercise) => exercise.name),
    ),
    replacementSource.plan.flatMap((day) => [
      ...day.warmups.map((exercise) => exercise.name),
      ...day.mainLifts.map((exercise) => exercise.name),
    ]),
    `${replacementSource.label} replaces the graph without retaining old exercises`,
  );

  const roundTripReplacement = routineModel.routinePlanFromRows(
    persistenceRowsFromPayload(
      routineModel.routinePlanToRpcPayload(firstReplacement),
    ),
  );
  assertEqual(
    meaningfulRoutineFields(roundTripReplacement),
    meaningfulRoutineFields(firstReplacement),
    `${replacementSource.label} survives the authoritative persistence round trip`,
  );
}

const importedLegacyIds = new Set(
  exportedIntermediate.flatMap((day) => [
    ...day.warmups.map((exercise) => exercise.id),
    ...day.mainLifts.map((exercise) => exercise.id),
  ]),
);
const freshImportedRoutine = routineModel.legacyPlanToRoutinePlan(
  "Imported Routine",
  exportedIntermediate,
  editedRoutine.id,
);
assert(
  freshImportedRoutine.days
    .flatMap((day) => day.exercises)
    .every((exercise) => !importedLegacyIds.has(exercise.id)),
  "Unversioned import occurrence IDs are never trusted as database identities",
);

const aiLegacyIds = new Set(
  legacyPlan.flatMap((day) => [
    ...day.warmups.map((exercise) => exercise.id),
    ...day.mainLifts.map((exercise) => exercise.id),
  ]),
);
const freshAiRoutine = routineModel.legacyPlanToRoutinePlan(
  editedRoutine.name,
  legacyPlan,
  editedRoutine.id,
);
assert(
  freshAiRoutine.days
    .flatMap((day) => day.exercises)
    .every((exercise) => !aiLegacyIds.has(exercise.id)),
  "AI-provided occurrence IDs are never trusted as database identities",
);

const newRootRoutine = routineModel.legacyPlanToRoutinePlan(
  "First Routine",
  legacyPlan,
);
assert(
  newRootRoutine.id !== editedRoutine.id,
  "A new root UUID is generated when no verified active routine exists",
);

const strippedMigration = migrationSource.replace(/--.*$/gm, "");
const extractedRoutineFunction = extractRoutineSaveFunction(migrationSource);
const functionSource = maskSqlCommentsAndStrings(
  extractedRoutineFunction.definition,
  { maskStrings: false },
);
const childDeleteIndex = functionSource.search(
  /delete\s+from\s+public\.routine_days/i,
);
assert(
  /add column\s+exercise_id\s+text/i.test(strippedMigration),
  "Migration adds exercise_id",
);
assert(
  /add column\s+weight_unit\s+text/i.test(strippedMigration),
  "Migration adds weight_unit",
);
assert(
  /add column\s+rest_seconds\s+integer/i.test(strippedMigration),
  "Migration adds rest_seconds",
);
assert(
  /rest_seconds\s+is\s+null[\s\S]*rest_seconds\s*>\s*0[\s\S]*rest_seconds\s*<=\s*3600/i.test(strippedMigration),
  "Migration constrains optional rest seconds",
);
assert(
  /create\s+or\s+replace\s+function\s+public\.save_active_routine_v1/i.test(strippedMigration),
  "Migration creates versioned routine save RPC",
);
assert(/security\s+definer/i.test(functionSource), "Routine save RPC is SECURITY DEFINER");
assert(
  /set\s+search_path\s*=\s*pg_catalog/i.test(functionSource),
  "Routine save RPC pins search_path to pg_catalog",
);
assert(/auth\.uid\(\)/i.test(functionSource), "Routine save RPC derives identity from auth.uid()");
assert(
  !/p_routine\s*(?:->>|->|#>>|#>)\s*['\"]user_id['\"]/i.test(functionSource),
  "Routine save RPC never accepts payload user_id",
);
assert(
  /revoke\s+execute[\s\S]*save_active_routine_v1[\s\S]*from\s+PUBLIC,\s*anon/i.test(strippedMigration),
  "Routine save RPC is revoked from PUBLIC and anon",
);
assert(
  /grant\s+execute[\s\S]*save_active_routine_v1[\s\S]*to\s+authenticated/i.test(strippedMigration),
  "Routine save RPC is executable by authenticated users",
);
assert(
  /alter\s+function\s+public\.save_active_routine_v1\(jsonb\)\s+owner\s+to\s+postgres/i.test(strippedMigration),
  "Routine save RPC has the reviewed postgres definer owner",
);
for (const table of ["routines", "routine_days", "planned_exercises"]) {
  assert(
    new RegExp(`revoke\\s+all\\s+privileges\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+PUBLIC,\\s*anon,\\s*authenticated`, "i")
      .test(strippedMigration),
    `PUBLIC, anon, and authenticated inherited privileges are cleared on ${table}`,
  );
  assert(
    new RegExp(`grant\\s+select\\s+on\\s+table\\s+public\\.${table}\\s+to\\s+authenticated`, "i")
      .test(strippedMigration),
    `Authenticated retains SELECT on ${table}`,
  );
  assert(
    !new RegExp(`grant\\s+(?:[^;]*(?:insert|update|delete)[^;]*)\\s+on\\s+table\\s+public\\.${table}\\s+to\\s+authenticated`, "i")
      .test(strippedMigration),
    `Authenticated has no direct DML grant on ${table}`,
  );
}

const finalPrivilegeReview = privilegeViolations(migrationSource);
assertAdded(
  "privilegeState",
  finalPrivilegeReview.parseErrors.length === 0,
  `Relevant GRANT/REVOKE statements parse deterministically: ${finalPrivilegeReview.parseErrors.join("; ")}`,
);
assertAdded(
  "privilegeState",
  finalPrivilegeReview.functionCreateIndex >= 0,
  "Privilege evaluator observes routine function creation and PostgreSQL's default PUBLIC EXECUTE",
);
for (const table of routineTables) {
  for (const role of routineRoles) {
    const actual = [...finalPrivilegeReview.state.tables.get(table).get(role)].sort();
    const expected = role === "authenticated" ? ["select"] : [];
    assertAdded(
      "privilegeState",
      JSON.stringify(actual) === JSON.stringify(expected),
      `${role} has the exact final privilege allowlist on ${table}`,
    );
  }
}
for (const role of routineRoles) {
  const actual = [
    ...finalPrivilegeReview.state.functions.get(routineSaveFunction).get(role),
  ].sort();
  const expected = role === "authenticated" ? ["execute"] : [];
  assertAdded(
    "privilegeState",
    JSON.stringify(actual) === JSON.stringify(expected),
    `${role} has the exact final EXECUTE state on ${routineSaveFunction}`,
  );
}
assertAdded(
  "privilegeState",
  finalPrivilegeReview.violations.length === 0,
  `Final routine privilege state matches the reviewed allowlist: ${finalPrivilegeReview.violations.join("; ")}`,
);
assert(
  /select\s+routine\.user_id[\s\S]*from\s+public\.routines\s+as\s+routine/i.test(functionSource),
  "RPC preflights the routine UUID in the complete routine table space",
);
assert(
  /from\s+public\.routine_days\s+as\s+routine_day[\s\S]*routine_day\.id\s*=\s*any\(v_seen_day_ids\)/i.test(functionSource),
  "RPC preflights every submitted day UUID",
);
assert(
  /from\s+public\.planned_exercises\s+as\s+planned_exercise[\s\S]*planned_exercise\.id\s*=\s*any\(v_seen_occurrence_ids\)/i.test(functionSource),
  "RPC preflights every submitted occurrence UUID",
);
for (const marker of [
  "select routine.user_id",
  "from public.routine_days as routine_day",
  "from public.planned_exercises as planned_exercise",
]) {
  const markerIndex = functionSource.toLowerCase().indexOf(marker);
  assert(
    markerIndex >= 0 && markerIndex < childDeleteIndex,
    `${marker} preflight occurs before child replacement DML`,
  );
}

const firstDmlReview = preDmlViolations(migrationSource);
assertAdded(
  "firstDmlOrder",
  firstDmlReview.firstDml !== null,
  "Routine save RPC contains a detectable mutating SQL statement",
);
assertAdded(
  "firstDmlOrder",
  firstDmlReview.firstDml?.keyword === "update",
  "The actual first routine save DML is the caller-scoped active-routine UPDATE",
);
for (const marker of firstDmlReview.markers) {
  assertAdded(
    "firstDmlOrder",
    marker.index >= 0 && marker.endIndex <= firstDmlReview.firstDml.index,
    `${marker.label} occurs before the actual first DML statement`,
  );
}
assertAdded(
  "firstDmlOrder",
  firstDmlReview.violations.length === 0,
  `All critical graph validation precedes the actual first DML: ${firstDmlReview.violations.join("; ")}`,
);
assert(
  /jsonb_array_length\(v_days\)\s*<>\s*7/i.test(functionSource),
  "RPC requires exactly seven submitted days",
);
assert(
  /jsonb_typeof\(v_exercise\s*->\s*'order'\)\s+is\s+distinct\s+from\s+'number'/i.test(functionSource),
  "RPC validates required occurrence JSON field types before casting",
);
assert(
  /v_kind\s*=\s*'rest'\s+and\s+v_exercise_count\s*>\s*0/i.test(functionSource),
  "RPC rejects exercises on rest days",
);
assert(
  /for\s+v_index\s+in\s+0\.\.\(v_exercise_count\s*-\s*1\)[\s\S]*v_index\s*=\s*any\(v_seen_orders\)/i.test(functionSource),
  "RPC requires contiguous per-day occurrence order",
);
assert(
  /message\s*=\s*'ROUTINE_GRAPH_ID_CONFLICT'/i.test(functionSource),
  "RPC reports a generic graph-ID conflict",
);
assert(
  /exception\s+when\s+unique_violation[\s\S]*ROUTINE_GRAPH_ID_CONFLICT/i.test(functionSource),
  "RPC converts race-time unique conflicts to the generic conflict",
);
assert(
  /short_day\s*=\s*pg_catalog\.upper\(pg_catalog\.left\(day_name,\s*1\)\)/i.test(strippedMigration),
  "short_day is constrained to the weekday-derived compatibility value",
);
assert(
  !/create\s+index\s+routine_days_routine_idx/i.test(strippedMigration),
  "Migration omits the redundant routine-day parent index",
);
assertEqual(
  [...strippedMigration.matchAll(/delete\s+from\s+public\.([a-z_]+)/gi)].map((match) => match[1]),
  ["routines", "routine_days"],
  "Migration deletes only the reviewed routine root and RPC child replacement rows",
);
for (const protectedTable of [
  "workout_sessions",
  "workout_sets",
  "workout_completion_operations",
  "xp_events",
  "users",
]) {
  assert(
    !new RegExp(`(?:insert\\s+into|update|delete\\s+from|alter\\s+table|drop\\s+table|truncate(?:\\s+table)?)\\s+public\\.${protectedTable}`, "i").test(strippedMigration),
    `Migration does not mutate protected table ${protectedTable}`,
  );
}

assertAdded(
  "selfTests",
  privilegeViolations(migrationSource).violations.length === 0,
  "Privilege evaluator accepts the unmodified migration",
);

const privilegeMutationCases = [
  [
    "PUBLIC execute regrant",
    "grant execute on function public.save_active_routine_v1(jsonb) to PUBLIC;",
  ],
  [
    "anon execute regrant",
    "grant execute on function public.save_active_routine_v1(jsonb) to anon;",
  ],
  [
    "authenticated INSERT regrant",
    "grant insert on table public.routines to authenticated;",
  ],
  [
    "authenticated UPDATE regrant",
    "grant update on table public.routine_days to authenticated;",
  ],
  [
    "authenticated DELETE regrant",
    "grant delete on table public.planned_exercises to authenticated;",
  ],
  [
    "authenticated TRUNCATE regrant",
    "grant truncate on table public.routines to authenticated;",
  ],
];
for (const [label, mutation] of privilegeMutationCases) {
  const mutatedReview = privilegeViolations(`${migrationSource}\n${mutation}\n`);
  assertAdded(
    "selfTests",
    mutatedReview.violations.length > 0,
    `In-memory self-test rejects ${label}`,
  );
}

const earlyDmlMigration = injectAtFunctionBodyStart(
  migrationSource,
  "update public.routines set is_active = is_active where false;",
);
assertAdded(
  "selfTests",
  preDmlViolations(earlyDmlMigration).violations.length > 0,
  "In-memory self-test rejects DML injected before graph validation",
);

const commentedDmlMigration = injectAtFunctionBodyStart(
  migrationSource,
  "-- UPDATE public.routines SET is_active = false WHERE false;",
);
assertAdded(
  "selfTests",
  preDmlViolations(commentedDmlMigration).violations.length === 0,
  "First-DML detection ignores SQL comments",
);

const stringDmlMigration = injectAtFunctionBodyStart(
  migrationSource,
  "raise notice 'UPDATE public.routines SET is_active = false';",
);
assertAdded(
  "selfTests",
  preDmlViolations(stringDmlMigration).violations.length === 0,
  "First-DML detection ignores SQL keywords inside string literals",
);

const fetchRoutineStart = routineStoreSource.indexOf("fetchRoutine: async () => {");
const fetchRoutineEnd = routineStoreSource.indexOf("setRoutine:", fetchRoutineStart);
const fetchRoutineSource = routineStoreSource.slice(fetchRoutineStart, fetchRoutineEnd);
const fetchCatchStart = fetchRoutineSource.indexOf("} catch (error) {");
const fetchCatchSource = fetchRoutineSource.slice(fetchCatchStart);
assert(
  /loadStatus:\s*'error'[\s\S]*routine:\s*null|routine:\s*null[\s\S]*loadStatus:\s*'error'/i.test(fetchCatchSource),
  "A failed clean load keeps routine null and records an error state",
);
assert(
  !/legacyPlanToRoutinePlan\(/i.test(fetchCatchSource),
  "A failed load never manufactures a default routine",
);
assert(
  /state\.isDirty\s*&&\s*state\.routine/i.test(fetchCatchSource),
  "A failed load preserves an in-memory dirty draft",
);
assert(
  /loadStatus\s*===\s*['\"]idle['\"]/i.test(routineEditorSource),
  "Routine Editor fetches once from the idle state",
);
assert(
  /loadStatus\s*===\s*['\"]error['\"][\s\S]*Retry/i.test(routineEditorSource),
  "Routine Editor exposes a retry action after load failure",
);
assert(
  /disabled=\{isSaving\s*\|\|\s*loadStatus\s*!==\s*['\"]ready['\"]\}/i.test(routineEditorSource),
  "Routine Editor gates Save on a verified ready draft",
);

function extractStoreAction(startMarker, endMarker) {
  const start = routineStoreSource.indexOf(startMarker);
  const end = routineStoreSource.indexOf(endMarker, start);
  assert(start >= 0 && end > start, `Store action ${startMarker} is present`);
  return routineStoreSource.slice(start, end);
}

const replacementSource = extractStoreAction(
  "replaceAndSaveRoutine: async (plan, name) => {",
  "applyTemplate:",
);
const replacementLoadIndex = replacementSource.indexOf(
  "await get().fetchRoutine()",
);
const replacementReadyIndex = replacementSource.indexOf(
  "currentState.loadStatus !== 'ready'",
);
const replacementConvertIndex = replacementSource.indexOf(
  "replacement = legacyPlanToRoutinePlan",
);
const replacementInstallIndex = replacementSource.indexOf(
  "routine: replacement",
);
const replacementSaveIndex = replacementSource.indexOf(
  "await get().saveRoutineToDb()",
);
assert(
  replacementLoadIndex >= 0,
  "Shared replacement awaits an idle or in-flight authoritative load",
);
assert(
  replacementReadyIndex > replacementLoadIndex,
  "Shared replacement verifies ready state after awaiting load",
);
assert(
  /currentState\.loadStatus\s*!==\s*'ready'\s*\|\|\s*!currentState\.routine/i.test(
    replacementSource,
  ),
  "Shared replacement rejects load failure and unverified missing roots",
);
assert(
  /currentState\.routine\.id/i.test(replacementSource),
  "Shared replacement reuses the verified current routine root UUID",
);
assert(
  replacementConvertIndex > replacementReadyIndex
    && replacementInstallIndex > replacementConvertIndex
    && replacementSaveIndex > replacementInstallIndex,
  "Shared replacement validates, installs a dirty draft, then awaits save in order",
);
assert(
  /isDirty:\s*true/i.test(replacementSource),
  "Shared replacement marks its installed graph dirty before persistence",
);
assert(
  /currentState\.isSaving/i.test(replacementSource),
  "Shared replacement rejects concurrent full-graph saves",
);

const applyTemplateSource = extractStoreAction(
  "applyTemplate: async (templateId: string) => {",
  "applyAiRoutine:",
);
const applyAiSource = extractStoreAction(
  "applyAiRoutine: async (plan) => {",
  "exportRoutine:",
);
const importSource = extractStoreAction(
  "importRoutine: async (base64Str: string) => {",
  "saveCustomTemplate:",
);
const resetSource = extractStoreAction(
  "resetActiveSplit: async () => {",
  "clearAllCustomTemplates:",
);
assert(
  /await\s+get\(\)\.replaceAndSaveRoutine\(template\.plan,\s*template\.name\)/i.test(
    applyTemplateSource,
  ),
  "Predefined and custom template application await the shared durable replacement",
);
assert(
  /await\s+get\(\)\.replaceAndSaveRoutine\(plan\)/i.test(applyAiSource),
  "AI application awaits the shared durable replacement",
);
assert(
  /await\s+get\(\)\.replaceAndSaveRoutine\(plan,\s*'Imported Routine'\)/i.test(
    importSource,
  ),
  "Import awaits the shared durable replacement",
);
assert(
  /await\s+get\(\)\.replaceAndSaveRoutine\([\s\S]*PREDEFINED_TEMPLATES\[0\]\.plan[\s\S]*PREDEFINED_TEMPLATES\[0\]\.name/i.test(
    resetSource,
  ),
  "Reset awaits the shared durable replacement",
);
assert(
  /JSON\.parse[\s\S]*Array\.isArray[\s\S]*replaceAndSaveRoutine/i.test(importSource),
  "Import parses and shape-checks the legacy payload before replacement",
);

const applyHandlerStart = templatesPageSource.indexOf(
  "const handleApplyTemplate = async",
);
const applyHandlerEnd = templatesPageSource.indexOf(
  "const handleGenerateAi",
  applyHandlerStart,
);
const applyHandlerSource = templatesPageSource.slice(
  applyHandlerStart,
  applyHandlerEnd,
);
const awaitApplyIndex = applyHandlerSource.indexOf("await applyTemplate(id)");
assert(
  awaitApplyIndex >= 0,
  "Templates page awaits durable template application",
);
assert(
  applyHandlerSource.indexOf("toast.success", awaitApplyIndex) > awaitApplyIndex,
  "Template success is announced only after persistence succeeds",
);
assert(
  applyHandlerSource.indexOf('router.push("/routines")', awaitApplyIndex)
    > awaitApplyIndex,
  "Template navigation occurs only after persistence succeeds",
);
assert(
  /finally\s*\{[\s\S]*setApplyingId\(null\)/i.test(applyHandlerSource),
  "Template application re-enables retry after success or failure",
);
assert(
  /applyingId\s*!==\s*null\s*\|\|\s*appliedId\s*!==\s*null\s*\|\|\s*replacementUnavailable/i.test(
    templatesPageSource,
  ),
  "Template buttons are disabled during an in-flight application",
);
assert(
  /loadStatus\s*===\s*['"]idle['"][\s\S]*fetchRoutine\(\)/i.test(
    templatesPageSource,
  ),
  "Templates page loads the authoritative routine on cold direct navigation",
);
assert(
  /loadStatus\s*===\s*['"]error['"][\s\S]*Retry/i.test(templatesPageSource),
  "Templates page exposes a retry action after load failure",
);
assert(
  /replacementUnavailable\s*=\s*loadStatus\s*!==\s*['"]ready['"]\s*\|\|\s*isSaving/i.test(
    templatesPageSource,
  ),
  "Templates page disables graph replacement until load state is ready",
);

const aiDirectHandlerStart = templatesPageSource.indexOf(
  "const handleApplyAiDirectly = async",
);
const aiDirectHandlerEnd = templatesPageSource.indexOf(
  "const handleSaveAiTemplate",
  aiDirectHandlerStart,
);
const aiDirectHandlerSource = templatesPageSource.slice(
  aiDirectHandlerStart,
  aiDirectHandlerEnd,
);
const aiDirectAwaitIndex = aiDirectHandlerSource.indexOf(
  "await applyAiRoutine(generatedPlan)",
);
assert(aiDirectAwaitIndex >= 0, "AI Apply Directly awaits durable persistence");
assert(
  aiDirectHandlerSource.indexOf("toast.success", aiDirectAwaitIndex)
    > aiDirectAwaitIndex,
  "AI Apply Directly announces success only after durable persistence",
);
assert(
  aiDirectHandlerSource.indexOf('router.push("/routines")', aiDirectAwaitIndex)
    > aiDirectAwaitIndex,
  "AI Apply Directly navigates only after durable persistence",
);

const aiSaveHandlerStart = templatesPageSource.indexOf(
  "const handleSaveAiTemplate = async",
);
const aiSaveHandlerEnd = templatesPageSource.indexOf(
  "const handleSaveActiveTemplate",
  aiSaveHandlerStart,
);
const aiSaveHandlerSource = templatesPageSource.slice(
  aiSaveHandlerStart,
  aiSaveHandlerEnd,
);
const aiSaveAwaitIndex = aiSaveHandlerSource.indexOf(
  "await applyAiRoutine(generatedPlan)",
);
assert(aiSaveAwaitIndex >= 0, "AI Save & Apply awaits durable persistence");
assert(
  aiSaveHandlerSource.lastIndexOf("toast.success", aiSaveAwaitIndex) === -1,
  "AI Save & Apply emits no success toast before durable persistence",
);
assert(
  aiSaveHandlerSource.indexOf(
    'toast.success("Routine saved to My Plans and applied as the active split!")',
    aiSaveAwaitIndex,
  ) > aiSaveAwaitIndex,
  "AI Save & Apply announces active-routine success only after persistence",
);
assert(
  aiSaveHandlerSource.indexOf('router.push("/routines")', aiSaveAwaitIndex)
    > aiSaveAwaitIndex,
  "AI Save & Apply navigates only after persistence",
);

const importHandlerStart = routinesPageSource.indexOf(
  "const handleImport = async",
);
const importHandlerEnd = routinesPageSource.indexOf(
  "const handleResetActive",
  importHandlerStart,
);
const importHandlerSource = routinesPageSource.slice(
  importHandlerStart,
  importHandlerEnd,
);
const importAwaitIndex = importHandlerSource.indexOf(
  "await importRoutine(importCode)",
);
assert(importAwaitIndex >= 0, "Import UI awaits durable persistence");
assert(
  importHandlerSource.indexOf("toast.success", importAwaitIndex)
    > importAwaitIndex,
  "Import success is announced only after persistence",
);
assert(
  /finally\s*\{[\s\S]*setIsImporting\(false\)/i.test(importHandlerSource),
  "Import retry is re-enabled after success or failure",
);

const resetHandlerStart = routinesPageSource.indexOf(
  "const handleResetActive = async",
);
const resetHandlerEnd = routinesPageSource.indexOf(
  "const handleClearCustomTemplates",
  resetHandlerStart,
);
const resetHandlerSource = routinesPageSource.slice(
  resetHandlerStart,
  resetHandlerEnd,
);
const resetAwaitIndex = resetHandlerSource.indexOf(
  "await resetActiveSplit()",
);
assert(resetAwaitIndex >= 0, "Reset UI awaits durable persistence");
assert(
  resetHandlerSource.indexOf("toast.success", resetAwaitIndex)
    > resetAwaitIndex,
  "Reset success is announced only after persistence",
);
assert(
  /finally\s*\{[\s\S]*setIsResetting\(false\)/i.test(resetHandlerSource),
  "Reset retry is re-enabled after success or failure",
);
assert(
  /disabled=\{importCode\.length\s*===\s*0\s*\|\|\s*isImporting\s*\|\|\s*isSaving\s*\|\|\s*loadStatus\s*!==\s*'ready'\}/i.test(
    routinesPageSource,
  ),
  "Import is disabled until a verified routine state is ready",
);
assert(
  /disabled=\{isResetting\s*\|\|\s*isSaving\s*\|\|\s*loadStatus\s*!==\s*'ready'\}/i.test(
    routinesPageSource,
  ),
  "Reset is disabled until a verified routine state is ready",
);

const directRoutineMutation = applicationSources.find(({ source }) =>
  /\.from\(\s*["'](?:routines|routine_days|planned_exercises)["']\s*\)(?:(?!;)[\s\S]){0,1200}?\.(?:insert|update|upsert|delete)\s*\(/i.test(
    source,
  ),
);
assert(
  directRoutineMutation === undefined,
  `Active application source contains no direct routine-table DML${directRoutineMutation ? ` (${directRoutineMutation.path})` : ""}`,
);
assert(
  /supabase\.rpc\(["']save_active_routine_v1["']/i.test(
    applicationSources.map(({ source }) => source).join("\n"),
  ),
  "Active routine writes use the authoritative save_active_routine_v1 RPC",
);
assert(
  /const\s+routine\s*=\s*get\(\)\.routine[\s\S]*routinePlanToLegacyPlan\(routine\)/i.test(
    routineStoreSource,
  ),
  "Routine export serializes the current Zustand working draft",
);
assert(
  /currentDayPlan\.type\s*===\s*'Rest'\s*\?\s*'Recovery Activities'/i.test(
    templatesPageSource,
  ),
  "Legacy active-recovery template activities remain visible in preview",
);

if (failures.length > 0) {
  console.error(`Routine foundation validation failed (${failures.length}/${assertions}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Routine foundation validation passed: ${assertions} assertions.`);
console.log(
  `Validator hardening: ${addedAssertionCounts.privilegeState} privilege-state assertions, ` +
  `${addedAssertionCounts.firstDmlOrder} first-DML/order assertions, ` +
  `${addedAssertionCounts.selfTests} in-memory self-tests.`,
);
console.log("Serialization preserves routine identity, occurrence identity, units, rest, and order.");
console.log("Migration was inspected statically and was not applied.");
