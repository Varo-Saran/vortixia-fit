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
  fixtureFile,
  searchSource,
] = await Promise.all([
  readJson("src/data/exerciseLibrary.json"),
  readJson("src/data/exerciseMetadata.json"),
  readJson("src/data/vortixiaExercises.json"),
  readJson("scripts/fixtures/exercise-search-acceptance.json"),
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

for (const fixture of fixtureFile.fixtures) {
  const ids = resultIds(fixture.query, fixture.resultLimit ?? 50);
  if (fixture.deferred) continue;

  if (
    fixture.expectedTopIds?.length
    && !fixture.expectedTopIds.includes(ids[0])
  ) {
    fail(
      `${fixture.query}: top result ${ids[0] ?? "<none>"} was not one of ${fixture.expectedTopIds.join(", ")}`,
    );
  }

  for (const expectation of fixture.mustAppearWithinTopN ?? []) {
    const topIds = ids.slice(0, expectation.topN);
    const matches = expectation.ids.filter((id) => topIds.includes(id));
    const minimumMatches = expectation.minimumMatches ?? 1;
    if (matches.length < minimumMatches) {
      fail(
        `${fixture.query}: expected at least ${minimumMatches} of ${expectation.ids.join(", ")} within top ${expectation.topN}; got ${topIds.join(", ")}`,
      );
    }
  }

  for (const expectation of fixture.forbiddenWithinTopN ?? []) {
    const topIds = ids.slice(0, expectation.topN);
    const matches = expectation.ids.filter((id) => topIds.includes(id));
    if (matches.length > 0) {
      fail(
        `${fixture.query}: forbidden ${matches.join(", ")} appeared within top ${expectation.topN}`,
      );
    }
  }
}

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
    "lat",
    "pull down",
    "chest",
    "machine chest",
    "row",
    "back",
    "curl",
    "hamstring",
    "face pull",
    "side plank",
    "rowing machine",
    "bike",
    "barbell overhead press",
  ];
  for (const query of probes) {
    const results = searchModule.searchExerciseIndex(index, query, { limit: 8 });
    console.log(`\n${query}`);
    for (const { exercise, score } of results) {
      console.log(`  ${exercise.id}\t${score}\t${exercise.displayName}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Exercise search validation failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const deferredCount = fixtureFile.fixtures.filter(({ deferred }) => deferred).length;
console.log(
  `Exercise search validation passed: ${fixtureFile.fixtures.length} fixtures (${deferredCount} deferred), ${discoverableCatalog.length} discoverable records.`,
);
