import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { localTypeScriptLoader } from "./lib/load-local-typescript.mjs";

const load = localTypeScriptLoader();
const { BUILT_IN_ROUTINE_TEMPLATES: templates } = load("src/data/built-in-routine-templates.ts");
const model = load("src/lib/routine-model.ts");
const materializer = load("src/lib/routine-templates.ts");
const catalog = load("src/lib/exercise-catalog.ts");
const compatibility = load("src/lib/template-exercise-compatibility.ts");
let positive = 0;
let negative = 0;
function check(callback) { callback(); positive++; }
function rejects(label, callback) {
  assert.throws(callback, undefined, `Negative fixture must fail: ${label}`);
  negative++;
}

const choices = {
  C01: ["0025", "0289", "0151"], C02: ["0334", "0178", "0584"],
  C03: ["0201", "0200"], C04: ["0294", "0031", "0447"],
  C05: ["0043", "0770", "0042"], C06: ["0605", "0594", "1391"],
  C07: ["0032", "0117", "0811"], C08: ["0198", "0579"],
  C09: ["0739", "vx_ex_machine_leg_press", "0760"], C10: ["9003", "9001"],
  C12: ["0447", "0294"], C13: ["0043", "0770"], C14: ["0599", "0586"],
  C15: ["2141", "9003"], C16: ["vx_ex_wall_slide", "vx_ex_band_pull_apart"],
  C17: ["0031", "0447"], C18: ["vx_ex_dumbbell_hip_thrust", "9004"],
  Z: ["9003", "9001", "2141"],
};
const descriptions = [
  "High frequency hypertrophy split for advanced lifters.",
  "One muscle group per day. High volume per session.",
  "Vathsaran’s signature 5-day PPL protocol featuring glute emphasis, cramp-safe core, and post-workout Zone 2 cardio.",
];
const expectedDays = [
  [["training", "Push 1"], ["training", "Pull 1"], ["training", "Legs 1"], ["training", "Push 2"], ["training", "Pull 2"], ["training", "Legs 2"], ["recovery", "Active Recovery"]],
  [["training", "Chest Day"], ["training", "Back Day"], ["training", "Leg Day"], ["training", "Shoulder Day"], ["training", "Arm Day"], ["rest", "Rest"], ["rest", "Rest"]],
  [["training", "Chest & Triceps"], ["training", "Back & Biceps"], ["training", "Cardio, Core & Glute Activation"], ["training", "Legs, Hamstrings & Glutes"], ["training", "Shoulders, Biceps & Triceps"], ["recovery", "Active Recovery"], ["rest", "Full Rest"]],
];
const sequences = [
  ["C01 vx_ex_standing_barbell_overhead_press C02 C03", "0027 0652 C04", "C05 0085 C06", "0314 0251", "C07 C08", "C09 0585 9008", ""],
  ["C01", "0027", "C05", "vx_ex_standing_barbell_overhead_press", "0031", "", ""],
  [
    "3666 vx_ex_arm_swing vx_ex_arm_circle 0025 0314 0596 0158 0200 1749 Z",
    "C10 0197 0861 0292 0588 vx_ex_face_pull C12 0165 Z",
    "3666 0175 0276 0407 0223 vx_ex_bodyweight_side_plank 9008 3013 donkey_kicks",
    "9003 3013 1564 vx_ex_bodyweight_squat C13 C09 0085 C14 0585 vx_ex_dumbbell_walking_lunge C06 C18 3645 9006 3769 Z",
    "C15 C16 vx_ex_dumbbell_ytw_raise 0405 0603 C02 0225 C17 0201 0315 1722 Z",
    "9001 9003 1271 1511 1564 1365 2208 2202", "",
  ],
];
function approvedReference(code) {
  const ids = choices[code];
  return ids ? { kind: "choice", defaultExerciseId: ids[0], alternativeExerciseIds: ids.slice(1) }
    : { kind: "single", exerciseId: code };
}
function prescription(occurrence) {
  return [occurrence.targetSets, occurrence.targetValue, occurrence.trackingType, occurrence.weightUnit];
}

// Golden programming signatures lock all reviewed source notes/sets/targets,
// not just the highlighted corrections. Updated only after product review.
const approvedFingerprints = [
  "d93443f097020bb16ed66f9b6b5ae0c627c0a51d3005294ecb0514608cfa2c20",
  "c70993a220369add64c4a0d93cc619f6c725d393b5ef765c975121f326c8a2d3",
  "d63ef88b27e4eb96da1a1af216e46e122c8b0b2cb12b6b8472df7d6ba8f30ea4",
];
function fingerprint(template) {
  // Keep the pre-D2D golden lock on EVERY old field; Zones are locked separately.
  return createHash("sha256").update(JSON.stringify(template, (key, value) => key === 'cardioZone' ? undefined : value)).digest("hex");
}
function assertApprovedTemplates(values) {
  materializer.validateRoutineTemplates(values);
  assert.equal(values.length, 3);
  assert.deepEqual(values.map(t => t.id), ["tpl_ppl_6", "tpl_bro_5", "tpl_int_ppl_5"]);
  for (const [index, template] of values.entries()) {
    assert.equal(template.description, descriptions[index], "Locked template copy");
    assert.deepEqual(template.days.map(d => d.weekday), model.WEEKDAYS);
    assert.deepEqual(template.days.map(d => [d.kind, d.title]), expectedDays[index], "Locked day semantics");
    for (const [dayIndex, day] of template.days.entries()) {
      const codes = sequences[index][dayIndex].split(" ").filter(Boolean);
      assert.deepEqual(day.occurrences.map(o => o.exercise), codes.map(approvedReference), "Approved SINGLE/CHOICE sequence");
      assert(day.occurrences.every(o => o.restSeconds === null), "No fabricated rest overrides");
    }
    assert.equal(fingerprint(template), approvedFingerprints[index], "Locked complete programming graph");
  }
}
function assertDeepFrozen(value) {
  if (value && typeof value === "object") {
    assert(Object.isFrozen(value), "Built-in source must be deeply frozen");
    Object.values(value).forEach(assertDeepFrozen);
  }
}
function assertFresh(first, second) {
  const dayIds = new Set(first.days.map(d => d.id));
  const occurrenceIds = new Set(first.days.flatMap(d => d.exercises.map(e => e.id)));
  assert(second.days.every(d => !dayIds.has(d.id)), "Day IDs cannot be reused");
  assert(second.days.flatMap(d => d.exercises).every(e => !occurrenceIds.has(e.id)), "Occurrence IDs cannot be reused");
}
function rowsFromPayload(payload) {
  return {
    routine: { id: payload.id, name: payload.name },
    days: payload.days.map(d => ({ id: d.id, routine_id: payload.id, day_name: model.weekdayLabel(d.weekday), title: d.title, type: d.kind })),
    exercises: payload.days.flatMap(d => d.exercises.map(e => ({
      id: e.id, routine_day_id: d.id, exercise_id: e.exercise_id, name: e.name,
      type: e.target_muscle, tracking_style: e.tracking_type, weight_unit: e.weight_unit,
      target_sets: e.target_sets, target_reps: e.target_value, rest_seconds: e.rest_seconds,
      cardio_zone: e.cardioZone,
      note: e.note, is_warmup: e.section === "warmup", order_index: e.order,
    }))),
  };
}

check(() => assertApprovedTemplates(templates));
check(() => assertDeepFrozen(templates));
const sourceSnapshot = JSON.stringify(templates);
const root = model.createRoutineUuid();
const materialized = templates.map(template => materializer.materializeRoutineTemplate(template, root));
for (const [index, template] of templates.entries()) {
  const first = materialized[index];
  const second = materializer.materializeRoutineTemplate(template, root);
  const preview = materializer.resolveRoutineTemplate(template);
  check(() => model.assertValidRoutinePlan(first));
  check(() => assert.equal(first.id, root, "Verified root reused"));
  check(() => assertFresh(first, second));
  check(() => assert.equal(first.days.flatMap(d => d.exercises).length, [17, 5, 64][index]));
  check(() => assert.equal(materializer.templateTrainingFrequency(template), ["6 DAYS/WEEK", "5 DAYS/WEEK", "5 DAYS/WEEK"][index]));
  for (const [dayIndex, day] of first.days.entries()) {
    check(() => assert.deepEqual(day.exercises.map(e => e.order), day.exercises.map((_, i) => i)));
    check(() => assert.deepEqual(day.exercises.map(e => e.exerciseId), template.days[dayIndex].occurrences.map(o =>
      o.exercise.kind === "single" ? o.exercise.exerciseId : o.exercise.defaultExerciseId,
    ), "Every approved default materializes; no alternative is substituted"));
    check(() => assert.deepEqual(day.exercises.map(e => { const copy = { ...e }; delete copy.id; return copy; }), preview.days[dayIndex].exercises));
    for (const occurrence of template.days[dayIndex].occurrences) {
      for (const id of materializer.templateReferenceIds(occurrence.exercise)) {
        const exercise = catalog.getExerciseById(id);
        check(() => assert(exercise && exercise.approval !== "red" && exercise.discoveryTier !== "hidden" && !exercise.deprecatedForDiscovery && catalog.getPreferredExerciseId(id) === id));
        check(() => assert(compatibility.isTemplateProgrammingCompatible(exercise, occurrence.trackingType, occurrence.weightUnit, { templateId: template.id, weekday: day.weekday, occurrence })));
      }
    }
    for (const e of day.exercises) {
      const resolved = catalog.getExerciseById(e.exerciseId);
      check(() => assert.deepEqual([e.name, e.targetMuscle], [resolved.displayName, resolved.primaryMuscle]));
      check(() => assert.equal(e.restSeconds, null));
    }
  }
  const payload = model.routinePlanToRpcPayload(first);
  check(() => assert.deepEqual(model.routinePlanToRpcPayload(model.routinePlanFromRows(rowsFromPayload(payload))), payload));
  second.days[0].exercises[0].name = "Edited user routine";
  second.days[0].exercises.reverse();
  check(() => assert.equal(JSON.stringify(templates), sourceSnapshot, "Editable output cannot mutate source"));
}
const intermediate = templates[2];
const approvedZones = [[null, null, null, null, null, null, null], [null, null, null, null, null, null, null],
  [[9, 2], [0, 1, 8, 2], [0, 2], [0, 1, 15, 2], [0, 1, 11, 2], [0, 1, 1, 1], null]];
for (const [templateIndex, template] of templates.entries()) for (const [dayIndex, day] of template.days.entries()) {
  const values = approvedZones[templateIndex][dayIndex] ?? [];
  const expected = new Map(Array.from({ length: values.length / 2 }, (_, index) => [values[index * 2], values[index * 2 + 1]]));
  for (const occurrence of day.occurrences) check(() => assert.equal(occurrence.cardioZone, expected.get(occurrence.order) ?? null, 'Exact reviewed structured Zone per occurrence'));
}
check(() => assert.equal(materialized.flatMap(r => r.days.flatMap(d => d.exercises)).length, 86));
check(() => assert.deepEqual(intermediate.days.map(d => d.occurrences.length), [10, 9, 9, 16, 12, 8, 0]));
check(() => assert.equal(intermediate.days.flatMap(d => d.occurrences).filter(o => o.section === "warmup").length, 11));
check(() => assert.equal(intermediate.days.flatMap(d => d.occurrences).filter(o => o.section === "main").length, 53));
check(() => assert.deepEqual(intermediate.days[0].occurrences.slice(1, 3).map(prescription), [[2, "15", "reps_only", "unitless"], [2, "15", "reps_only", "unitless"]]));
check(() => assert(intermediate.days[0].occurrences.slice(1, 3).every(o => o.section === "warmup")));
check(() => assert.deepEqual(prescription(intermediate.days[3].occurrences[2]), [2, "30 seconds each side", "time_only", "unitless"]));
check(() => assert.equal(intermediate.days[3].occurrences[2].note, "Each set: 30 seconds per side, 60 seconds total. Complete two sets."));
check(() => assert.deepEqual(prescription(intermediate.days[3].occurrences[3]), [2, "10", "reps_only", "unitless"]));
const recovery = intermediate.days[5].occurrences.slice(2);
check(() => assert(recovery.every(o => JSON.stringify(prescription(o)) === JSON.stringify([1, "3 mins total", "time_only", "unitless"]) && o.section === "main")));
check(() => assert.equal(recovery.reduce((sum, o) => sum + o.targetSets * Number.parseInt(o.targetValue), 0), 18));
check(() => assert(recovery.every((o, i) => o.note === `Part ${i + 1}/6 of the 18-minute total recovery protocol. Three minutes total includes side changes; not three minutes per side.`)));
for (const dayIndex of [0, 1, 3, 4]) {
  const zone = intermediate.days[dayIndex].occurrences.at(-1);
  check(() => assert.deepEqual(zone.exercise, approvedReference("Z")));
  check(() => assert.deepEqual(prescription(zone), [1, "30 mins", "time_only", "unitless"]));
  check(() => assert.equal(zone.note, "Zone 2. Aerobic base building."));
  check(() => assert.equal(materialized[2].days[dayIndex].exercises.at(-1).exerciseId, "9003"));
}
check(() => assert.deepEqual(prescription(intermediate.days[2].occurrences[0]), [1, "30-35 mins", "time_only", "unitless"]));
check(() => assert.equal(intermediate.days[2].occurrences[0].note, "12-15% incline, 5.5-6.5 km/h. Zone 2."));
check(() => assert.deepEqual(intermediate.days[1].occurrences[2].exercise, { kind: "single", exerciseId: "0861" }));
check(() => assert.equal(intermediate.days[1].occurrences[2].note, undefined));
for (const [day, order, expected] of [[0, 2, [3, "15", "reps_weight", "kg"]], [1, 2, [3, "12", "reps_weight", "kg"]], [3, 0, [4, "10", "reps_weight", "kg"]]]) {
  check(() => assert.deepEqual(prescription(templates[0].days[day].occurrences[order]), expected));
}
check(() => assert.deepEqual(prescription(intermediate.days[4].occurrences[2]), [2, "10 each shape", "reps_only", "unitless"]));
for (const o of [templates[0].days[5].occurrences[0], intermediate.days[3].occurrences[5]]) check(() => assert.equal(o.weightUnit, "kg"));
check(() => assert.equal(Object.keys(compatibility.REVIEWED_IMPORTED_TEMPLATE_PAIRS).length, 66));
const allReferences = new Set(templates.flatMap(t => t.days.flatMap(d => d.occurrences.flatMap(o => materializer.templateReferenceIds(o.exercise)))));
check(() => assert.equal([...allReferences].filter(id => id.startsWith("vx_ex_")).length, 12));
check(() => assert.deepEqual([...allReferences].filter(id => !id.startsWith("vx_ex_")).sort(), Object.keys(compatibility.REVIEWED_IMPORTED_TEMPLATE_PAIRS).sort()));
check(() => assert.equal(new Set(templates.flatMap(t => t.days.flatMap(d => d.occurrences.filter(o => o.exercise.kind === "choice").map(o => JSON.stringify(o.exercise))))).size, 18));
check(() => assert(!model.isDayStartable(materialized[0].days[6]) && !model.isDayStartable(materialized[2].days[5])));

// Positive lb translation fixture uses a catalog-declared supported unit, not
// an imported capability expansion. It does not alter approved source data.
const poundsTemplate = structuredClone(intermediate);
poundsTemplate.days[3].occurrences[11].exercise = { kind: "single", exerciseId: "vx_ex_dumbbell_hip_thrust" };
poundsTemplate.days[3].occurrences[11].weightUnit = "lb";
const poundsRoutine = materializer.materializeRoutineTemplate(poundsTemplate, root);
check(() => assert.equal(poundsRoutine.days[3].exercises[11].weightUnit, "lbs"));
check(() => assert.equal(model.routinePlanToRpcPayload(poundsRoutine).days[3].exercises[11].weight_unit, "lbs"));
check(() => assert.equal(JSON.stringify(templates), sourceSnapshot));

function invalid(label, mutate, locked = false) {
  const fixture = structuredClone(templates);
  mutate(fixture);
  // Structural fixtures must fail the runtime validator itself, not merely
  // a golden snapshot. Product-semantic fixtures additionally check locks.
  rejects(label, () => locked ? assertApprovedTemplates(fixture) : materializer.validateRoutineTemplates(fixture));
}
invalid("duplicate template ID", t => t[1].id = t[0].id);
invalid("duplicate weekday", t => t[0].days[1].weekday = "monday");
invalid("missing weekday", t => t[0].days.pop());
invalid("invalid weekday", t => t[0].days[0].weekday = "funday");
invalid("malformed kind", t => t[0].days[0].kind = "push");
invalid("empty title", t => t[0].days[0].title = " ");
invalid("rest with occurrence", t => t[0].days[0].kind = "rest");
invalid("duplicate order", t => t[0].days[0].occurrences[1].order = 0);
invalid("gapped order", t => t[0].days[0].occurrences[1].order = 4);
invalid("missing ID", t => t[0].days[0].occurrences[0].exercise.defaultExerciseId = "not_in_catalog");
invalid("missing alternative", t => t[0].days[0].occurrences[0].exercise.alternativeExerciseIds.push("not_in_catalog"));
invalid("raw name identity", t => t[0].days[0].occurrences[0].exercise = { kind: "single", name: "Bench Press" });
for (const field of ["name", "displayName", "targetMuscle", "primaryMuscle", "secondaryMuscles", "aliases", "equipment", "movementType"]) {
  invalid(`duplicated canonical ${field}`, t => t[0].days[0].occurrences[0][field] = "forbidden");
}
invalid("invalid tracking/unit", t => t[0].days[0].occurrences[0].weightUnit = "unitless");
invalid("unauthorized imported pair", t => t[2].days[3].occurrences[2].trackingType = "reps_only");
invalid("unknown imported capability", t => t[0].days[0].occurrences[0].exercise = { kind: "single", exerciseId: "0001" });
invalid("YTW exception outside warmup", t => t[2].days[4].occurrences[2].section = "main");
invalid("YTW different prescription", t => t[2].days[4].occurrences[2].targetSets = 3);
invalid("invalid section", t => t[0].days[0].occurrences[0].section = "cooldown");
invalid("invalid sets", t => t[0].days[0].occurrences[0].targetSets = 0);
invalid("empty target", t => t[0].days[0].occurrences[0].targetValue = "");
invalid("oversized note", t => t[0].days[0].occurrences[0].note = "x".repeat(1001));
invalid("invalid rest", t => t[0].days[0].occurrences[0].restSeconds = 3601);
invalid("unapproved rest override", t => t[0].days[0].occurrences[0].restSeconds = 90, true);
invalid("Saturday kind", t => t[2].days[5].kind = "training", true);
invalid("Sunday kind", t => t[2].days[6].kind = "recovery", true);
invalid("Sunday title", t => t[2].days[6].title = "Rest", true);
for (const kind of ["rest", "training"]) invalid(`PPL Sunday ${kind}`, t => t[0].days[6].kind = kind, true);
for (const day of [5, 6]) invalid("Bro weekend recovery", t => t[1].days[day].kind = "recovery", true);
for (const index of [0, 1, 2]) invalid("changed locked description", t => t[index].description += " Revised.", true);
invalid("C11 back extension", t => t[2].days[1].occurrences[2].exercise = { kind: "choice", defaultExerciseId: "0861", alternativeExerciseIds: ["0573"] }, true);
invalid("Zone 2 fake identity", t => t[2].days[0].occurrences.at(-1).exercise = { kind: "single", exerciseId: "zone_2_cardio" });
invalid("COMP03 wrong allocation", t => t[2].days[5].occurrences[2].targetValue = "15-20 mins", true);
for (const [label, predicate] of [
  ["RED", e => e.approval === "red"], ["hidden", e => e.discoveryTier === "hidden"],
  ["deprecated", e => e.deprecatedForDiscovery], ["preferred source", e => catalog.getPreferredExerciseId(e.id) !== e.id],
]) {
  const prohibited = catalog.getExerciseCatalog().find(predicate);
  assert(prohibited, `Catalog fixture required: ${label}`);
  invalid(label, t => t[0].days[0].occurrences[0].exercise = { kind: "single", exerciseId: prohibited.id });
}
const leakedPounds = structuredClone(poundsRoutine);
leakedPounds.days[3].exercises[11].weightUnit = "lb";
rejects("lb in RoutinePlan", () => model.assertValidRoutinePlan(leakedPounds));
rejects("frozen source mutation", () => templates[0].days[0].occurrences.push({}));
rejects("unfrozen blueprint invariant", () => assertDeepFrozen(structuredClone(templates)));
const reusedOccurrences = materializer.materializeRoutineTemplate(intermediate, root);
reusedOccurrences.days[0].exercises[0].id = materialized[2].days[0].exercises[0].id;
rejects("occurrence reuse between applications", () => assertFresh(materialized[2], reusedOccurrences));
const reusedDays = materializer.materializeRoutineTemplate(intermediate, root);
reusedDays.days[0].id = materialized[2].days[0].id;
rejects("day reuse between applications", () => assertFresh(materialized[2], reusedDays));

// Audit actual runtime AST, not comments. Catalog access must be by stable ID;
// disallow search/name APIs from becoming a hidden identity fallback.
const materializerSource = readFileSync("src/lib/routine-templates.ts", "utf8");
const ast = ts.createSourceFile("routine-templates.ts", materializerSource, ts.ScriptTarget.Latest, true);
const calls = [];
function visit(node) {
  if (ts.isCallExpression(node)) calls.push(node.expression.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
check(() => assert(calls.includes("getExerciseById")));
check(() => assert(!calls.some(c => /search|alias|byname/i.test(c))));

// Exercise actual Zustand actions with local IO stubs. No Supabase module is
// loaded and no real RPC is called. D1's gating/error boundary remains intact.
function localStore(loadActiveRoutine, saveActiveRoutine) {
  let persistOptions;
  const storeLoader = localTypeScriptLoader({
    // Existing replacement fixtures now explicitly approve the new shared UI
    // guard. They still exercise the real store boundary and persistence.
    "@/lib/routine-draft-guard": { confirmRoutineDiscard: async () => true, RoutineGuardCancelledError: class extends Error {} },
    "@/lib/routine-persistence": { loadActiveRoutine, saveActiveRoutine },
    "zustand/middleware": { persist: (initializer, options) => { persistOptions = options; return initializer; } },
    "zustand": { create: () => initializer => {
      let state;
      const get = () => state;
      const set = update => { state = { ...state, ...(typeof update === "function" ? update(state) : update) }; };
      state = initializer(set, get);
      return { getState: get, setState: set };
    } },
  });
  const store = storeLoader("src/store/useRoutineStore.ts").useRoutineStore;
  return { store, persistOptions };
}
let saved = null;
let saveCalls = 0;
const { store, persistOptions } = localStore(async () => saved, async routine => {
  saveCalls++;
  assert.equal(store.getState().isDirty, true);
  saved = model.routinePlanFromRows(rowsFromPayload(model.routinePlanToRpcPayload(routine)));
  return saved;
});
await store.getState().fetchRoutine();
check(() => assert.equal(saveCalls, 0, "Viewing no-routine default does not save"));
check(() => assert.equal(store.getState().routine.name, templates[0].name));
check(() => assert.deepEqual(Object.keys(persistOptions.partialize(store.getState())), ["customTemplates"]));
const defaultRoot = store.getState().routine.id;
await store.getState().applyTemplate("tpl_int_ppl_5");
check(() => assert.equal(saveCalls, 1));
check(() => assert.equal(saved.id, defaultRoot));
check(() => assert.equal(store.getState().isDirty, false));
check(() => assert.equal(saved.days.flatMap(d => d.exercises).length, 64));
const appliedOnce = saved;
await store.getState().applyTemplate("tpl_int_ppl_5");
check(() => assertFresh(appliedOnce, saved));
check(() => assert.equal(saved.id, defaultRoot));
await store.getState().resetActiveSplit();
check(() => assert.equal(saved.id, defaultRoot));
check(() => assert.equal(saved.name, templates[0].name));
check(() => assert.equal(saved.days.flatMap(d => d.exercises).length, 17));
const legacyCopy = model.routinePlanToLegacyPlan(materialized[2]);
check(() => assert(store.getState().saveCustomTemplate("Custom copy", "Existing custom template", legacyCopy)));
const customId = store.getState().customTemplates[0].id;
await store.getState().applyTemplate(customId);
check(() => assert.equal(saved.name, "Custom copy"));
await store.getState().applyAiRoutine(legacyCopy);
check(() => assert.equal(saved.days.flatMap(d => d.exercises).length, 64));
await store.getState().importRoutine(btoa(encodeURIComponent(JSON.stringify(legacyCopy))));
check(() => assert.equal(saved.name, "Imported Routine"));
const freshSession = localStore(async () => saved, async () => { throw new Error("No save during read"); });
await freshSession.store.getState().fetchRoutine();
check(() => assert.deepEqual(freshSession.store.getState().routine, saved));
const pending = {};
const failedSaveStore = localStore(async () => materialized[0], () => new Promise((resolve, reject) => Object.assign(pending, { resolve, reject })));
const applying = failedSaveStore.store.getState().applyTemplate("tpl_int_ppl_5");
await new Promise(resolve => setImmediate(resolve));
check(() => assert.equal(failedSaveStore.store.getState().isSaving, true));
check(() => assert.equal(failedSaveStore.store.getState().isDirty, true));
await assert.rejects(failedSaveStore.store.getState().applyTemplate("tpl_int_ppl_5"), /already in progress/);
positive++;
const originalConsoleError = console.error;
console.error = () => {}; // Expected IO fixture errors only; never suppress validator failures.
try {
  pending.reject(new Error("Synthetic save failure"));
  await assert.rejects(applying, /Synthetic save failure/);
  positive++;
  check(() => assert.equal(failedSaveStore.store.getState().isDirty, true));
  check(() => assert.equal(failedSaveStore.store.getState().isSaving, false));
  check(() => assert.equal(failedSaveStore.store.getState().error, "Synthetic save failure"));
  check(() => assert.equal(failedSaveStore.store.getState().routine.name, intermediate.name));
  const retry = failedSaveStore.store.getState().saveRoutineToDb();
  pending.resolve(failedSaveStore.store.getState().routine);
  await retry;
  check(() => assert.equal(failedSaveStore.store.getState().isDirty, false));
  let unsafeSaves = 0;
  const loadFailure = localStore(async () => { throw new Error("Synthetic read failure"); }, async () => { unsafeSaves++; });
  await assert.rejects(loadFailure.store.getState().applyTemplate("tpl_int_ppl_5"), /Load the saved routine successfully/);
  positive++;
  check(() => assert.equal(unsafeSaves, 0));
  check(() => assert.equal(loadFailure.store.getState().routine, null));
  check(() => assert.equal(loadFailure.store.getState().loadStatus, "error"));
  let failRead = true;
  let readAttempts = 0;
  let retrySaves = 0;
  const retryStore = localStore(async () => {
    readAttempts++;
    if (failRead) throw new Error("Synthetic initial read failure");
    return null;
  }, async routine => { retrySaves++; return routine; });
  await retryStore.store.getState().fetchRoutine();
  check(() => assert.equal(retryStore.store.getState().routine, null));
  failRead = false;
  await retryStore.store.getState().fetchRoutine();
  check(() => assert.equal(retryStore.store.getState().loadStatus, "ready"));
  check(() => assert.equal(retrySaves, 0));
  const verifiedDraft = retryStore.store.getState().routine;
  retryStore.store.getState().setRoutine({ ...verifiedDraft, name: "Unsaved dirty edits" });
  await retryStore.store.getState().fetchRoutine();
  check(() => assert.equal(readAttempts, 2, "Dirty draft prevents background reload"));
  check(() => assert.equal(retryStore.store.getState().routine.name, "Unsaved dirty edits"));
  await retryStore.store.getState().applyTemplate("tpl_int_ppl_5");
  check(() => assert.equal(retryStore.store.getState().routine.id, verifiedDraft.id));
  check(() => assert.equal(retryStore.store.getState().routine.name, intermediate.name));
  check(() => assert.equal(retrySaves, 1));

  let releaseLoad;
  let deferredSaves = 0;
  const loadingStore = localStore(() => new Promise(resolve => { releaseLoad = resolve; }), async routine => { deferredSaves++; return routine; });
  const loading = loadingStore.store.getState().fetchRoutine();
  const waitingApply = loadingStore.store.getState().applyTemplate("tpl_int_ppl_5");
  check(() => assert.equal(loadingStore.store.getState().loadStatus, "loading"));
  check(() => assert.equal(deferredSaves, 0));
  releaseLoad(materialized[0]);
  await Promise.all([loading, waitingApply]);
  check(() => assert.equal(loadingStore.store.getState().routine.id, root));
  check(() => assert.equal(deferredSaves, 1));
} finally { console.error = originalConsoleError; }
check(() => assert.equal(persistOptions.version, 1, "Existing custom-template migration version unchanged"));
const customSnapshot = structuredClone(store.getState().customTemplates);
check(() => assert.deepEqual(persistOptions.merge({ customTemplates: customSnapshot }, store.getState()).customTemplates, customSnapshot));
check(() => assert.equal(JSON.stringify(templates), sourceSnapshot));

console.log(`Template validation passed: ${positive} positive assertions, ${negative} negative fixtures.`);
console.log("3 immutable templates; PPL 17, Bro 5, Intermediate 64; total 86 occurrences (11 warmups).");
console.log("78 catalog IDs; 66 exact imported compatibility pairs; 12 Vortixia IDs; 18 unique CHOICE references.");
console.log("Actual materializer, preview, D1 serialization/row roundtrip, and mocked-IO store actions exercised.");
console.log("No database, Production, or browser network was called. Live RPC/runtime semantics remain D1 staging evidence.");
