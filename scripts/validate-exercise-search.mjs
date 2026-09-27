import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

const [
  importedExercises,
  metadataFile,
  vortixiaExercises,
  coreFixtureFile,
  friendFixtureFile,
  searchSource,
] = await Promise.all([
  readJson("src/data/exerciseLibrary.json"),
  readJson("src/data/exerciseMetadata.json"),
  readJson("src/data/vortixiaExercises.json"),
  readJson("scripts/fixtures/exercise-search-acceptance.json"),
  readJson("scripts/fixtures/exercise-search-friend-feedback.json"),
  readFile(path.join(root, "src/lib/exercise-search.ts"), "utf8"),
]);

const transpiledSearch = ts.transpileModule(searchSource, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: "exercise-search.ts",
});
const searchModule = await import(
  `data:text/javascript;base64,${Buffer.from(transpiledSearch.outputText).toString("base64")}`
);

const failures = [];

function fail(message) {
  failures.push(message);
}

function normalizeEquipment(equipment) {
  const value = equipment.toLowerCase();
  const normalized = value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.includes("ez bar")) return "ez_bar";
  if (value.includes("smith")) return "smith_machine";
  if (value.includes("sled")) return "sled_machine";
  if (value.includes("barbell") || value === "olympic barbell") return "barbell";
  if (value.includes("dumbbell")) return "dumbbell";
  if (value.includes("cable")) return "cable";
  if (value.includes("kettlebell")) return "kettlebell";
  if (value.includes("band")) return "band";
  if (value.includes("body weight")) return "bodyweight";
  if (value.includes("leverage") || value === "machine" || value === "assisted") {
    return "machine";
  }
  if (
    [
      "stationary bike",
      "elliptical machine",
      "stepmill machine",
      "skierg machine",
      "upper body ergometer",
      "rowing machine",
    ].includes(value)
  ) {
    return "cardio_machine";
  }
  return "other";
}

function fallbackSecondaryMuscles(record) {
  const target = record.target.toLowerCase();
  return [...new Set(
    record.muscleGroup
      .split("/")
      .map((muscle) => muscle.trim().toLowerCase())
      .filter((muscle) => muscle && muscle !== target),
  )];
}

const metadataById = new Map(
  metadataFile.entries.map((entry) => [entry.id, entry]),
);
const resolvedCatalog = [...importedExercises, ...vortixiaExercises].map((record) => {
  const metadata = metadataById.get(record.id);
  return {
    ...record,
    source: record.source === "vortixia" ? "vortixia" : "imported",
    displayName: metadata?.displayName ?? record.name,
    aliases: metadata?.aliases ?? [],
    normalizedEquipment:
      metadata?.normalizedEquipment ?? normalizeEquipment(record.equipment),
    equipmentConfidence: metadata?.equipmentConfidence ?? "local",
    primaryMuscle: metadata?.primaryMuscle ?? record.target,
    secondaryMuscles:
      metadata?.secondaryMuscles ?? fallbackSecondaryMuscles(record),
    approval: metadata?.approval,
    discoveryTier: metadata?.discoveryTier ?? "extended",
    curationSet: metadata?.curationSet,
    deprecatedForDiscovery: metadata?.deprecatedForDiscovery ?? false,
    preferredExerciseId: metadata?.preferredExerciseId,
    reviewFlags: metadata?.reviewFlags ?? [],
    defaultTrackingType: record.defaultTrackingType,
    supportedWeightUnits: record.supportedWeightUnits,
  };
});

const discoverableCatalog = resolvedCatalog.filter(
  (exercise) =>
    !exercise.deprecatedForDiscovery && exercise.discoveryTier !== "hidden",
);
const index = searchModule.createExerciseSearchIndex(discoverableCatalog);

if (resolvedCatalog.length !== 1_352) {
  fail(`Expected 1,352 source records; found ${resolvedCatalog.length}`);
}
if (discoverableCatalog.length !== 1_343 || index.documents.length !== 1_343) {
  fail(
    `Expected 1,343 discoverable/indexed records; found ${discoverableCatalog.length}/${index.documents.length}`,
  );
}

function resultIds(query, limit = 50) {
  return searchModule
    .searchExerciseIndex(index, query, { limit })
    .map(({ exercise }) => exercise.id);
}

const completeCatalogIds = new Set(resolvedCatalog.map(({ id }) => id));
const supportedFixtureFields = new Set([
  "acceptableTopGroupIds",
  "classification",
  "deferred",
  "expectedNoResults",
  "expectedTopIds",
  "forbiddenTopIds",
  "forbiddenWithinTopN",
  "mustAppearWithinTopN",
  "normalizationVariantGroup",
  "note",
  "query",
  "resultLimit",
  "status",
]);
const directIdFields = [
  "expectedTopIds",
  "acceptableTopGroupIds",
  "forbiddenTopIds",
];
const nestedIdFields = [
  "mustAppearWithinTopN",
  "forbiddenWithinTopN",
];

function validateIdList({ label, fixture, position, field, value, issues }) {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({
      indexes: [position - 1],
      message: `${label} fixture #${position} "${fixture.query}": ${field} must be a non-empty array`,
    });
    return;
  }

  for (const id of value) {
    if (typeof id !== "string" || !id.trim()) {
      issues.push({
        indexes: [position - 1],
        message: `${label} fixture #${position} "${fixture.query}": ${field} contains a non-string or empty exercise ID`,
      });
    } else if (!completeCatalogIds.has(id)) {
      issues.push({
        indexes: [position - 1],
        message: `${label} fixture #${position} "${fixture.query}": ${field} references unknown exercise ID "${id}"`,
      });
    }
  }
}

function validateFixtureStructure(label, fixtures) {
  const issues = [];
  const rawQueries = new Map();
  const normalizedQueries = new Map();
  const normalizedFormsByVariantGroup = new Map();

  if (!Array.isArray(fixtures)) {
    return {
      issues: [{ indexes: [], message: `${label}: fixtures must be an array` }],
      invalidIndexes: new Set(),
    };
  }

  fixtures.forEach((fixture, index) => {
    const position = index + 1;
    const fixtureIssues = [];
    const addIssue = (message) => fixtureIssues.push({ indexes: [index], message });

    if (!fixture || typeof fixture !== "object" || Array.isArray(fixture)) {
      addIssue(`${label} fixture #${position}: fixture must be an object`);
      issues.push(...fixtureIssues);
      return;
    }

    for (const field of Object.keys(fixture)) {
      if (!supportedFixtureFields.has(field)) {
        addIssue(
          `${label} fixture #${position} "${fixture.query ?? "<missing>"}": unsupported field "${field}"`,
        );
      }
    }

    if (
      typeof fixture.query !== "string"
      || !fixture.query.trim()
      || fixture.query !== fixture.query.trim()
    ) {
      addIssue(`${label} fixture #${position}: query must be a non-empty trimmed string`);
    } else {
      const rawEntries = rawQueries.get(fixture.query) ?? [];
      rawEntries.push({ fixture, index, position });
      rawQueries.set(fixture.query, rawEntries);

      const normalizedQuery = searchModule.normalizeExerciseSearchQuery(
        fixture.query,
      );
      const normalizedEntries = normalizedQueries.get(normalizedQuery) ?? [];
      normalizedEntries.push({ fixture, index, position });
      normalizedQueries.set(normalizedQuery, normalizedEntries);

      if (fixture.normalizationVariantGroup !== undefined) {
        if (
          typeof fixture.normalizationVariantGroup !== "string"
          || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
            fixture.normalizationVariantGroup,
          )
        ) {
          addIssue(
            `${label} fixture #${position} "${fixture.query}": normalizationVariantGroup must be a non-empty lowercase kebab-case string`,
          );
        } else {
          const existingForm = normalizedFormsByVariantGroup.get(
            fixture.normalizationVariantGroup,
          );
          if (existingForm !== undefined && existingForm !== normalizedQuery) {
            addIssue(
              `${label} fixture #${position} "${fixture.query}": normalizationVariantGroup "${fixture.normalizationVariantGroup}" is already assigned to normalized query "${existingForm || "<empty>"}", not "${normalizedQuery || "<empty>"}"`,
            );
          } else {
            normalizedFormsByVariantGroup.set(
              fixture.normalizationVariantGroup,
              normalizedQuery,
            );
          }
        }
      }
    }

    if (
      fixture.status !== undefined
      && fixture.status !== "active"
      && fixture.status !== "deferred"
    ) {
      addIssue(
        `${label} fixture #${position} "${fixture.query}": unsupported fixture status "${fixture.status}"`,
      );
    }
    if (fixture.deferred !== undefined && typeof fixture.deferred !== "boolean") {
      addIssue(
        `${label} fixture #${position} "${fixture.query}": deferred must be boolean`,
      );
    }
    if (fixture.deferred && fixture.status === "active") {
      addIssue(
        `${label} fixture #${position} "${fixture.query}": deferred cannot be true when status is active`,
      );
    }
    if (
      fixture.expectedNoResults !== undefined
      && typeof fixture.expectedNoResults !== "boolean"
    ) {
      addIssue(
        `${label} fixture #${position} "${fixture.query}": expectedNoResults must be boolean`,
      );
    }
    if (
      fixture.resultLimit !== undefined
      && (!Number.isInteger(fixture.resultLimit) || fixture.resultLimit <= 0)
    ) {
      addIssue(
        `${label} fixture #${position} "${fixture.query}": resultLimit must be a positive integer`,
      );
    }
    for (const field of ["classification", "note"]) {
      if (
        fixture[field] !== undefined
        && (typeof fixture[field] !== "string" || !fixture[field].trim())
      ) {
        addIssue(
          `${label} fixture #${position} "${fixture.query}": ${field} must be a non-empty string`,
        );
      }
    }

    for (const field of directIdFields) {
      if (fixture[field] !== undefined) {
        validateIdList({
          label,
          fixture,
          position,
          field,
          value: fixture[field],
          issues: fixtureIssues,
        });
      }
    }

    for (const field of nestedIdFields) {
      if (fixture[field] === undefined) continue;
      if (!Array.isArray(fixture[field]) || fixture[field].length === 0) {
        addIssue(
          `${label} fixture #${position} "${fixture.query}": ${field} must be a non-empty array`,
        );
        continue;
      }

      fixture[field].forEach((expectation, expectationIndex) => {
        const nestedField = `${field}[${expectationIndex}]`;
        if (
          !expectation
          || typeof expectation !== "object"
          || Array.isArray(expectation)
        ) {
          addIssue(
            `${label} fixture #${position} "${fixture.query}": ${nestedField} must be an object`,
          );
          return;
        }

        const supportedNestedFields = field === "mustAppearWithinTopN"
          ? new Set(["ids", "minimumMatches", "topN"])
          : new Set(["ids", "topN"]);
        for (const nestedKey of Object.keys(expectation)) {
          if (!supportedNestedFields.has(nestedKey)) {
            addIssue(
              `${label} fixture #${position} "${fixture.query}": ${nestedField} has unsupported field "${nestedKey}"`,
            );
          }
        }

        validateIdList({
          label,
          fixture,
          position,
          field: `${nestedField}.ids`,
          value: expectation.ids,
          issues: fixtureIssues,
        });
        if (!Number.isInteger(expectation.topN) || expectation.topN <= 0) {
          addIssue(
            `${label} fixture #${position} "${fixture.query}": ${nestedField}.topN must be a positive integer`,
          );
        }
        if (
          expectation.minimumMatches !== undefined
          && (
            !Number.isInteger(expectation.minimumMatches)
            || expectation.minimumMatches <= 0
            || expectation.minimumMatches > (expectation.ids?.length ?? 0)
          )
        ) {
          addIssue(
            `${label} fixture #${position} "${fixture.query}": ${nestedField}.minimumMatches must be a positive integer no greater than its ID count`,
          );
        }
      });
    }

    issues.push(...fixtureIssues);
  });

  for (const [query, entries] of rawQueries) {
    if (entries.length <= 1) continue;
    issues.push({
      indexes: entries.map(({ index }) => index),
      message: `${label}: exact raw query "${query}" is duplicated at fixture positions ${entries.map(({ position }) => position).join(", ")}`,
    });
  }

  for (const [normalizedQuery, entries] of normalizedQueries) {
    if (entries.length <= 1) continue;
    const variantGroups = entries.map(
      ({ fixture }) => fixture.normalizationVariantGroup,
    );
    const uniqueGroups = new Set(variantGroups);
    const hasValidSharedGroup =
      variantGroups.every(
        (group) => typeof group === "string" && group.trim().length > 0,
      )
      && uniqueGroups.size === 1;

    if (!hasValidSharedGroup) {
      const collisionDetails = entries
        .map(
          ({ fixture, position }) =>
            `#${position} "${fixture.query}" [${fixture.normalizationVariantGroup ?? "<unannotated>"}]`,
        )
        .join(", ");
      issues.push({
        indexes: entries.map(({ index }) => index),
        message: `${label}: normalized query "${normalizedQuery || "<empty>"}" collides across ${collisionDetails}`,
      });
    }
  }

  return {
    issues,
    invalidIndexes: new Set(issues.flatMap(({ indexes }) => indexes)),
  };
}

function validateFixtureGroup(label, fixtures) {
  const stats = {
    label,
    total: fixtures.length,
    passed: 0,
    failed: 0,
    deferred: 0,
  };

  const structure = validateFixtureStructure(label, fixtures);
  for (const issue of structure.issues) fail(issue.message);

  fixtures.forEach((fixture, index) => {
    const isDeferred = fixture.deferred || fixture.status === "deferred";
    if (isDeferred) {
      stats.deferred += 1;
      return;
    }
    if (structure.invalidIndexes.has(index)) {
      stats.failed += 1;
      return;
    }

    const failuresBeforeFixture = failures.length;
    const ids = resultIds(fixture.query, fixture.resultLimit ?? 50);

    if (fixture.expectedNoResults && ids.length > 0) {
      fail(
        `${label}/${fixture.query}: expected no results; got ${ids.slice(0, 10).join(", ")}`,
      );
    }

    if (
      fixture.expectedTopIds?.length
      && !fixture.expectedTopIds.includes(ids[0])
    ) {
      fail(
        `${label}/${fixture.query}: top result ${ids[0] ?? "<none>"} was not one of ${fixture.expectedTopIds.join(", ")}`,
      );
    }

    if (
      fixture.acceptableTopGroupIds?.length
      && !fixture.acceptableTopGroupIds.includes(ids[0])
    ) {
      fail(
        `${label}/${fixture.query}: top result ${ids[0] ?? "<none>"} was not in acceptable group ${fixture.acceptableTopGroupIds.join(", ")}`,
      );
    }

    if (fixture.forbiddenTopIds?.includes(ids[0])) {
      fail(
        `${label}/${fixture.query}: forbidden top result ${ids[0]} was returned`,
      );
    }

    for (const expectation of fixture.mustAppearWithinTopN ?? []) {
      const topIds = ids.slice(0, expectation.topN);
      const matches = expectation.ids.filter((id) => topIds.includes(id));
      const minimumMatches = expectation.minimumMatches ?? 1;
      if (matches.length < minimumMatches) {
        fail(
          `${label}/${fixture.query}: expected at least ${minimumMatches} of ${expectation.ids.join(", ")} within top ${expectation.topN}; got ${topIds.join(", ")}`,
        );
      }
    }

    for (const expectation of fixture.forbiddenWithinTopN ?? []) {
      const topIds = ids.slice(0, expectation.topN);
      const matches = expectation.ids.filter((id) => topIds.includes(id));
      if (matches.length > 0) {
        fail(
          `${label}/${fixture.query}: forbidden ${matches.join(", ")} appeared within top ${expectation.topN}`,
        );
      }
    }

    if (failures.length === failuresBeforeFixture) {
      stats.passed += 1;
    } else {
      stats.failed += 1;
    }
  });

  return stats;
}

let coreFixtures = coreFixtureFile.fixtures;
let friendFixtures = friendFixtureFile.fixtures;
if (process.argv.includes("--self-proof-invalid-id")) {
  friendFixtures = [
    ...friendFixtures,
    {
      query: "validator invalid ID proof",
      status: "deferred",
      classification: "ambiguous",
      forbiddenTopIds: ["invalid_exercise_id"],
      note: "Synthetic in-memory validator proof; never written to fixtures.",
    },
  ];
}
if (process.argv.includes("--self-proof-duplicate")) {
  friendFixtures = [
    ...friendFixtures,
    {
      query: "dumbbell-squats",
      status: "active",
      expectedTopIds: ["0413"],
      note: "Synthetic in-memory validator proof; never written to fixtures.",
    },
  ];
}
if (process.argv.includes("--self-proof-annotated")) {
  friendFixtures = [
    ...friendFixtures,
    {
      query: "scapula_pushup",
      status: "active",
      normalizationVariantGroup: "scapular-pushup-language",
      expectedTopIds: ["3021"],
      note: "Synthetic in-memory validator proof; never written to fixtures.",
    },
  ];
}

const coreStats = validateFixtureGroup(
  "core acceptance",
  coreFixtures,
);
const friendStats = validateFixtureGroup(
  "friend feedback",
  friendFixtures,
);

const pecDeckIds = resultIds("pec deck", 10);
if (pecDeckIds.includes("0596")) {
  fail("pec deck: unverified ID 0596 must not receive a high-confidence match");
}

const expectedVortixiaIds = [
  "vx_ex_face_pull",
  "vx_ex_bodyweight_side_plank",
  "vx_ex_wall_slide",
  "vx_ex_band_pull_apart",
  "vx_ex_rowing_machine",
  "vx_ex_bodyweight_squat",
  "vx_ex_standing_barbell_overhead_press",
  "vx_ex_dumbbell_walking_lunge",
  "vx_ex_dumbbell_ytw_raise",
];
for (const id of expectedVortixiaIds) {
  if (!index.documentsById.has(id)) {
    fail(`Vortixia exercise ${id} is not discoverable`);
  }
}

const vortixiaSearchCases = [
  ["face pull", "vx_ex_face_pull"],
  ["side plank", "vx_ex_bodyweight_side_plank"],
  ["wall slide", "vx_ex_wall_slide"],
  ["band pull apart", "vx_ex_band_pull_apart"],
  ["rowing machine", "vx_ex_rowing_machine"],
  ["bodyweight squat", "vx_ex_bodyweight_squat"],
  ["barbell overhead press", "vx_ex_standing_barbell_overhead_press"],
  ["walking lunge", "vx_ex_dumbbell_walking_lunge"],
  ["ytw", "vx_ex_dumbbell_ytw_raise"],
];
for (const [query, expectedId] of vortixiaSearchCases) {
  if (!resultIds(query, 10).includes(expectedId)) {
    fail(`${query}: Vortixia exercise ${expectedId} was not within the top 10`);
  }
}

const categoryCases = [
  ["cardio", "rowing machine", "vx_ex_rowing_machine"],
  ["shoulders", "face pull", "vx_ex_face_pull"],
  ["waist", "side plank", "vx_ex_bodyweight_side_plank"],
  ["upper legs", "bodyweight squat", "vx_ex_bodyweight_squat"],
];
for (const [category, query, expectedId] of categoryCases) {
  const categoryIds = searchModule
    .searchExerciseIndex(index, query, { category, limit: 20 })
    .map(({ exercise }) => exercise.id);
  if (!categoryIds.includes(expectedId)) {
    fail(`${category}/${query}: expected ${expectedId} in category-filtered results`);
  }
}

for (const hiddenId of [
  "9009",
  "9010",
  "1628",
  "1371",
  "1463",
  "1464",
  "0869",
  "2318",
  "1614",
]) {
  if (index.documentsById.has(hiddenId)) {
    fail(`Hidden/deprecated record ${hiddenId} was indexed for discovery`);
  }
}

if (process.argv.includes("--probes")) {
  const probes = [
    "dumbbell squats",
    "ab crunch",
    "scapular push up",
    "calf raises",
    "reverse lunges",
    "tibialis raises",
    "body weight squats",
    "incline dumbbell chest press",
    "chest workout",
    "back workout",
    "leg workout",
    "stretching",
    "overhead dumbbell tricep extension",
    "standing hip circle",
    "leg swings",
    "arm circles",
    "towel lat pulls",
    "child pose",
    "seal stretch",
    "cat cow pose",
    "bird dog",
    "standing torso twists",
    "wall angels",
  ];
  for (const query of probes) {
    const results = searchModule.searchExerciseIndex(index, query, { limit: 8 });
    console.log(`\n${query}`);
    for (const { exercise, score } of results) {
      console.log(`  ${exercise.id}\t${score}\t${exercise.displayName}`);
    }
  }
}

const combinedStats = {
  total: coreStats.total + friendStats.total,
  passed: coreStats.passed + friendStats.passed,
  failed: coreStats.failed + friendStats.failed,
  deferred: coreStats.deferred + friendStats.deferred,
};

for (const stats of [coreStats, friendStats]) {
  console.log(
    `${stats.label}: ${stats.total} total, ${stats.passed} passed, ${stats.failed} failed, ${stats.deferred} deferred.`,
  );
}
console.log(
  `Combined: ${combinedStats.total} total, ${combinedStats.passed} passed, ${combinedStats.failed} failed, ${combinedStats.deferred} deferred.`,
);

if (failures.length > 0) {
  console.error(`Exercise search validation failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  `Exercise search validation passed: ${discoverableCatalog.length} discoverable records.`,
);
