import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const IMPORTED_CATALOG_PATH = "src/data/exerciseLibrary.json";
const METADATA_PATH = "src/data/exerciseMetadata.json";
const VORTIXIA_EXERCISES_PATH = "src/data/vortixiaExercises.json";
const EXPECTED_IMPORTED_CATALOG_SHA256 =
  "6733b08ad33da29ed92fa0efbb080092c349a71b0729c30c7d037586d15fd346";

const VALID_APPROVALS = new Set(["green", "yellow", "red"]);
const VALID_DISCOVERY_TIERS = new Set([
  "priority",
  "advanced",
  "extended",
  "hidden",
]);
const VALID_EQUIPMENT = new Set([
  "barbell",
  "dumbbell",
  "ez_bar",
  "cable",
  "machine",
  "smith_machine",
  "sled_machine",
  "bodyweight",
  "band",
  "kettlebell",
  "cardio_machine",
  "other",
]);
const VALID_MACHINE_SUBTYPES = new Set([
  "selectorized",
  "plate_loaded",
  "leverage",
  "sled",
  "smith",
  "unknown",
]);
const VALID_CONFIDENCE = new Set([
  "local",
  "corroborated_external",
  "conservative",
  "review_required",
]);
const VALID_REVIEW_FLAGS = new Set([
  "asset",
  "mechanism",
  "movement_identity",
  "target_metadata",
  "discovery",
  "license",
]);
const VALID_TRACKING_TYPES = new Set([
  "reps_weight",
  "time_weight",
  "time_only",
  "cardio_hr",
  "reps_only",
]);
const VALID_WEIGHT_UNITS = new Set(["kg", "lb", "plates", "unitless"]);
const MACHINE_EQUIPMENT = new Set([
  "machine",
  "smith_machine",
  "sled_machine",
]);

const EXPECTED_PREFERRED_MAPPINGS = new Map([
  ["9009", "0652"],
  ["9010", "1326"],
  ["1628", "0454"],
  ["1371", "0088"],
  ["1463", "0739"],
  ["1464", "0739"],
  ["0869", "0603"],
  ["2318", "0603"],
  ["1614", "0592"],
]);

const EXPECTED_CURATED_EZ_BAR_IDS = new Set([
  "0447",
  "0454",
  "1628",
  "1749",
]);

const EXPECTED_VORTIXIA_IDS = new Set([
  "vx_ex_face_pull",
  "vx_ex_bodyweight_side_plank",
  "vx_ex_wall_slide",
  "vx_ex_band_pull_apart",
  "vx_ex_rowing_machine",
  "vx_ex_bodyweight_squat",
  "vx_ex_standing_barbell_overhead_press",
  "vx_ex_dumbbell_walking_lunge",
  "vx_ex_dumbbell_ytw_raise",
]);

const EXPECTED_SUPPLEMENTAL_IMPORTED_IDS = new Set([
  "0197",
  "0128",
  "1615",
  "1616",
  "1463",
  "1464",
  "0869",
  "2318",
  "1614",
]);

const EXPECTED_VORTIXIA_RECORDS = new Map([
  ["vx_ex_face_pull", {
    name: "cable rope face pull",
    bodyPart: "shoulders",
    target: "delts",
    equipment: "cable",
    muscleGroup: "upper back / traps / rotator-cuff group / biceps",
    defaultTrackingType: "reps_weight",
    supportedWeightUnits: ["plates"],
    primaryMuscle: "rear delts",
    secondaryMuscles: ["upper back", "traps", "rotator-cuff group", "biceps"],
  }],
  ["vx_ex_bodyweight_side_plank", {
    name: "bodyweight side plank",
    bodyPart: "waist",
    target: "abs",
    equipment: "body weight",
    muscleGroup: "abs / glutes / shoulders",
    defaultTrackingType: "time_only",
    supportedWeightUnits: ["unitless"],
    primaryMuscle: "obliques",
    secondaryMuscles: ["abs", "glutes", "shoulders"],
  }],
  ["vx_ex_wall_slide", {
    name: "bodyweight wall slide",
    bodyPart: "shoulders",
    target: "serratus anterior",
    equipment: "body weight",
    muscleGroup: "delts / traps / upper back",
    defaultTrackingType: "reps_only",
    supportedWeightUnits: ["unitless"],
    primaryMuscle: "serratus anterior",
    secondaryMuscles: ["delts", "traps", "upper back"],
  }],
  ["vx_ex_band_pull_apart", {
    name: "resistance band pull-apart",
    bodyPart: "shoulders",
    target: "delts",
    equipment: "band",
    muscleGroup: "upper back / traps",
    defaultTrackingType: "reps_only",
    supportedWeightUnits: ["unitless"],
    primaryMuscle: "rear delts",
    secondaryMuscles: ["upper back", "traps"],
  }],
  ["vx_ex_rowing_machine", {
    name: "rowing machine",
    bodyPart: "cardio",
    target: "cardiovascular system",
    equipment: "rowing machine",
    muscleGroup: "upper back / lats / quads / hamstrings / glutes / biceps",
    defaultTrackingType: "cardio_hr",
    supportedWeightUnits: ["unitless"],
    primaryMuscle: "cardiovascular system",
    secondaryMuscles: ["upper back", "lats", "quads", "hamstrings", "glutes", "biceps"],
  }],
  ["vx_ex_bodyweight_squat", {
    name: "bodyweight squat",
    bodyPart: "upper legs",
    target: "quads",
    equipment: "body weight",
    muscleGroup: "glutes / hamstrings / calves / core",
    defaultTrackingType: "reps_only",
    supportedWeightUnits: ["unitless"],
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "hamstrings", "calves", "core"],
  }],
  ["vx_ex_standing_barbell_overhead_press", {
    name: "standing barbell overhead press",
    bodyPart: "shoulders",
    target: "delts",
    equipment: "barbell",
    muscleGroup: "triceps / upper chest / core",
    defaultTrackingType: "reps_weight",
    supportedWeightUnits: ["kg", "lb"],
    primaryMuscle: "delts",
    secondaryMuscles: ["triceps", "upper chest", "core"],
  }],
  ["vx_ex_dumbbell_walking_lunge", {
    name: "dumbbell walking lunge",
    bodyPart: "upper legs",
    target: "quads",
    equipment: "dumbbell",
    muscleGroup: "glutes / hamstrings / calves",
    defaultTrackingType: "reps_weight",
    supportedWeightUnits: ["kg", "lb"],
    primaryMuscle: "quads",
    secondaryMuscles: ["glutes", "hamstrings", "calves"],
  }],
  ["vx_ex_dumbbell_ytw_raise", {
    name: "dumbbell y-t-w raise",
    bodyPart: "shoulders",
    target: "delts",
    equipment: "dumbbell",
    muscleGroup: "upper back / traps / rotator-cuff group",
    defaultTrackingType: "reps_weight",
    supportedWeightUnits: ["kg", "lb"],
    primaryMuscle: "rear delts",
    secondaryMuscles: ["upper back", "traps", "rotator-cuff group"],
  }],
]);

const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};

const parseJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const importedCatalogBytes = readFileSync(IMPORTED_CATALOG_PATH);
const importedExercises = JSON.parse(importedCatalogBytes.toString("utf8"));
const metadataFile = parseJson(METADATA_PATH);
const vortixiaExercises = parseJson(VORTIXIA_EXERCISES_PATH);

const normalize = (value) => value
  .normalize("NFKD")
  .replace(/\p{Diacritic}/gu, "")
  .toLowerCase()
  .replace(/&/g, " and ")
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const normalizeEquipment = (equipment) => {
  const value = equipment.toLowerCase();
  const normalizedValue = value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalizedValue.includes("ez bar")) return "ez_bar";
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
};

const countBy = (items, key) => items.reduce((counts, item) => {
  const value = item[key];
  counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}, {});

const findDuplicates = (values) => {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
};

const catalogHash = createHash("sha256")
  .update(importedCatalogBytes)
  .digest("hex");
check(
  catalogHash === EXPECTED_IMPORTED_CATALOG_SHA256,
  `Canonical catalog SHA-256 changed: ${catalogHash}`,
);

check(Array.isArray(importedExercises), "Imported catalog must be an array");
check(Array.isArray(vortixiaExercises), "Vortixia additions must be an array");
check(
  metadataFile && metadataFile.version === 1,
  "Metadata file version must be 1",
);
check(Array.isArray(metadataFile?.entries), "Metadata entries must be an array");

const importedIds = importedExercises.map((record) => record.id);
const vortixiaIds = vortixiaExercises.map((record) => record.id);
const sourceRecords = [...importedExercises, ...vortixiaExercises];
const sourceById = new Map(sourceRecords.map((record) => [record.id, record]));
const entries = metadataFile.entries ?? [];
const entryById = new Map(entries.map((entry) => [entry.id, entry]));

const importedEzBarRecords = importedExercises.filter((record) => {
  const normalizedEquipmentName = normalize(record.equipment);
  const normalizedExerciseName = normalize(record.name);
  return normalizedEquipmentName.includes("ez bar")
    || normalizedExerciseName.includes("ez bar");
});
check(
  importedEzBarRecords.length === 23,
  `Expected 23 imported EZ-Bar source records, found ${importedEzBarRecords.length}`,
);
for (const record of importedEzBarRecords) {
  check(
    normalizeEquipment(record.equipment) === "ez_bar",
    `${record.id} imported EZ-Bar equipment normalized as ${normalizeEquipment(record.equipment)}`,
  );
}

for (const id of EXPECTED_CURATED_EZ_BAR_IDS) {
  check(
    entryById.get(id)?.normalizedEquipment === "ez_bar",
    `${id} curated EZ-Bar record must use normalized equipment ez_bar`,
  );
}

const EQUIPMENT_REGRESSION_FIXTURES = new Map([
  ["0025", "barbell"],
  ["0748", "smith_machine"],
  ["0577", "machine"],
  ["0198", "cable"],
  ["0289", "dumbbell"],
]);
for (const [id, expectedEquipment] of EQUIPMENT_REGRESSION_FIXTURES) {
  const record = sourceById.get(id);
  check(Boolean(record), `${id} equipment regression fixture must resolve`);
  if (record) {
    check(
      normalizeEquipment(record.equipment) === expectedEquipment,
      `${id} equipment regression: expected ${expectedEquipment}, got ${normalizeEquipment(record.equipment)}`,
    );
  }
}

for (const record of sourceRecords) {
  check(typeof record.id === "string", `Source ID must remain a string: ${record.id}`);
  for (const field of ["name", "bodyPart", "target", "equipment", "muscleGroup"]) {
    check(
      typeof record[field] === "string" && record[field].trim().length > 0,
      `Source ${record.id} has invalid ${field}`,
    );
  }
}

check(
  findDuplicates(importedIds).length === 0,
  `Duplicate imported IDs: ${findDuplicates(importedIds).join(", ")}`,
);
check(
  findDuplicates(vortixiaIds).length === 0,
  `Duplicate Vortixia IDs: ${findDuplicates(vortixiaIds).join(", ")}`,
);
check(
  findDuplicates([...importedIds, ...vortixiaIds]).length === 0,
  `Imported/Vortixia ID collision: ${findDuplicates([...importedIds, ...vortixiaIds]).join(", ")}`,
);
check(
  findDuplicates(entries.map((entry) => entry.id)).length === 0,
  `Duplicate metadata IDs: ${findDuplicates(entries.map((entry) => entry.id)).join(", ")}`,
);

for (const record of vortixiaExercises) {
  check(
    /^vx_ex_[a-z0-9]+(?:_[a-z0-9]+)*$/.test(record.id),
    `Invalid Vortixia ID: ${record.id}`,
  );
  check(record.source === "vortixia", `${record.id} must declare Vortixia source`);
  check(
    VALID_TRACKING_TYPES.has(record.defaultTrackingType),
    `${record.id} has invalid default tracking type`,
  );
  check(
    Array.isArray(record.supportedWeightUnits)
      && record.supportedWeightUnits.length > 0
      && record.supportedWeightUnits.every((unit) => VALID_WEIGHT_UNITS.has(unit)),
    `${record.id} has invalid supported units`,
  );

  const expected = EXPECTED_VORTIXIA_RECORDS.get(record.id);
  check(Boolean(expected), `${record.id} is not an approved Vortixia addition`);
  if (expected) {
    for (const field of [
      "name",
      "bodyPart",
      "target",
      "equipment",
      "muscleGroup",
      "defaultTrackingType",
    ]) {
      check(
        record[field] === expected[field],
        `${record.id} ${field} differs from the approved specification`,
      );
    }
    check(
      JSON.stringify(record.supportedWeightUnits)
        === JSON.stringify(expected.supportedWeightUnits),
      `${record.id} supported units differ from the approved specification`,
    );
  }
}

check(
  sourceRecords.every((record) => !record.id.startsWith("usr_ex_")),
  "Built-in catalog must not use the reserved usr_ex_ prefix",
);
check(vortixiaExercises.length === 9, "Expected exactly 9 Vortixia additions");
check(
  vortixiaIds.length === EXPECTED_VORTIXIA_IDS.size
    && vortixiaIds.every((id) => EXPECTED_VORTIXIA_IDS.has(id)),
  "Vortixia addition ID set does not match the approved specification",
);

const discoverableDisplayNames = new Map();
const discoverableIdentityOwners = new Map();
const discoverableAliasOwners = new Map();
for (const entry of entries) {
  const source = sourceById.get(entry.id);
  check(Boolean(source), `Metadata ID does not resolve: ${entry.id}`);
  check(typeof entry.id === "string", `Metadata ID must be a string: ${entry.id}`);
  check(
    !Object.hasOwn(entry, "name"),
    `${entry.id} metadata must not overwrite the canonical name`,
  );
  check(VALID_APPROVALS.has(entry.approval), `${entry.id} has invalid approval`);
  check(
    VALID_DISCOVERY_TIERS.has(entry.discoveryTier),
    `${entry.id} has invalid discovery tier`,
  );
  check(
    VALID_EQUIPMENT.has(entry.normalizedEquipment),
    `${entry.id} has invalid normalized equipment`,
  );
  check(
    VALID_CONFIDENCE.has(entry.equipmentConfidence),
    `${entry.id} has invalid equipment confidence`,
  );
  check(
    typeof entry.primaryMuscle === "string" && entry.primaryMuscle.trim().length > 0,
    `${entry.id} has invalid primary muscle`,
  );
  check(
    Array.isArray(entry.secondaryMuscles)
      && entry.secondaryMuscles.every((muscle) => typeof muscle === "string" && muscle.trim()),
    `${entry.id} has invalid secondary muscles`,
  );
  if (entry.machineSubtype !== undefined) {
    check(
      VALID_MACHINE_SUBTYPES.has(entry.machineSubtype),
      `${entry.id} has invalid machine subtype`,
    );
    check(
      MACHINE_EQUIPMENT.has(entry.normalizedEquipment),
      `${entry.id} has machine subtype on non-machine equipment`,
    );
  }

  if (entry.approval === "green" || entry.approval === "yellow") {
    check(
      typeof entry.displayName === "string" && entry.displayName.trim().length > 0,
      `${entry.id} requires a display name`,
    );
  }
  if (entry.approval === "yellow") {
    check(
      Array.isArray(entry.reviewFlags) && entry.reviewFlags.length > 0,
      `${entry.id} YELLOW entry requires a review flag`,
    );
  }
  if (entry.reviewFlags !== undefined) {
    check(
      Array.isArray(entry.reviewFlags)
        && entry.reviewFlags.every((flag) => VALID_REVIEW_FLAGS.has(flag)),
      `${entry.id} has invalid review flags`,
    );
  }

  if (entry.approval === "red") {
    check(entry.discoveryTier === "hidden", `${entry.id} RED entry must be hidden`);
    check(entry.deprecatedForDiscovery === true, `${entry.id} RED entry must be deprecated`);
    check(Array.isArray(entry.aliases) && entry.aliases.length === 0, `${entry.id} RED aliases must be empty`);
    check(
      typeof entry.preferredExerciseId === "string",
      `${entry.id} RED entry requires a preferred ID`,
    );
  }
  if (entry.deprecatedForDiscovery) {
    check(entry.discoveryTier === "hidden", `${entry.id} deprecated entry must be hidden`);
  }
  if (entry.preferredExerciseId !== undefined) {
    check(
      sourceById.has(entry.preferredExerciseId),
      `${entry.id} preferred ID does not resolve: ${entry.preferredExerciseId}`,
    );
    check(entry.preferredExerciseId !== entry.id, `${entry.id} cannot prefer itself`);
  }

  if (entry.displayName !== undefined) {
    check(entry.displayName === entry.displayName.trim(), `${entry.id} display name is not trimmed`);
    check(
      !/[ÃÂ�]|â€|в°/.test(entry.displayName),
      `${entry.id} display name contains mojibake`,
    );
    check(
      !/\b(?:version|v)\.?\s*\d+\b/i.test(entry.displayName),
      `${entry.id} display name exposes a version suffix`,
    );
  }

  check(Array.isArray(entry.aliases), `${entry.id} aliases must be an array`);
  const aliasKeys = new Set();
  const canonicalKey = source ? normalize(source.name) : "";
  const displayKey = entry.displayName ? normalize(entry.displayName) : "";
  for (const alias of entry.aliases ?? []) {
    check(typeof alias === "string", `${entry.id} alias must be a string`);
    check(alias === alias.trim() && alias.length > 0, `${entry.id} alias is empty/untrimmed`);
    const aliasKey = normalize(alias);
    check(aliasKey.length > 0, `${entry.id} alias normalizes to empty`);
    check(!aliasKeys.has(aliasKey), `${entry.id} has duplicate normalized alias: ${alias}`);
    check(aliasKey !== displayKey, `${entry.id} alias duplicates display name: ${alias}`);
    check(aliasKey !== canonicalKey, `${entry.id} alias duplicates canonical name: ${alias}`);
    aliasKeys.add(aliasKey);
  }

  if (
    entry.displayName
    && entry.discoveryTier !== "hidden"
    && !entry.deprecatedForDiscovery
  ) {
    const key = normalize(entry.displayName);
    const prior = discoverableDisplayNames.get(key);
    check(!prior, `${entry.id} display duplicates discoverable ${prior}: ${entry.displayName}`);
    discoverableDisplayNames.set(key, entry.id);

    for (const identityName of [source?.name, entry.displayName]) {
      const identityKey = normalize(identityName ?? "");
      if (!identityKey) continue;
      const owners = discoverableIdentityOwners.get(identityKey) ?? new Set();
      owners.add(entry.id);
      discoverableIdentityOwners.set(identityKey, owners);
    }
    for (const alias of entry.aliases ?? []) {
      const aliasKey = normalize(alias);
      const owners = discoverableAliasOwners.get(aliasKey) ?? new Set();
      owners.add(entry.id);
      discoverableAliasOwners.set(aliasKey, owners);
    }
  }
}

for (const [aliasKey, owners] of discoverableAliasOwners) {
  check(
    owners.size === 1,
    `Alias must not collapse discoverable identities: ${aliasKey} -> ${[...owners].join(", ")}`,
  );
  const aliasOwner = [...owners][0];
  const identityOwners = discoverableIdentityOwners.get(aliasKey) ?? new Set();
  const otherIdentityOwners = [...identityOwners].filter((id) => id !== aliasOwner);
  check(
    otherIdentityOwners.length === 0,
    `Alias on ${aliasOwner} duplicates another discoverable identity: ${aliasKey} -> ${otherIdentityOwners.join(", ")}`,
  );
}

for (const startId of entryById.keys()) {
  const visited = new Set();
  let currentId = startId;
  while (entryById.get(currentId)?.preferredExerciseId) {
    check(!visited.has(currentId), `Preferred-ID cycle starts at ${startId}`);
    if (visited.has(currentId)) break;
    visited.add(currentId);
    currentId = entryById.get(currentId).preferredExerciseId;
  }
}

const setCounts = countBy(entries, "curationSet");
check(setCounts.priority_2026_09_25 === 221, "Priority curation set must contain 221 entries");
check(setCounts.supplemental_2026_09_25 === 9, "Supplemental curation set must contain 9 entries");
check(setCounts.vortixia_addition_2026_09_25 === 9, "Addition curation set must contain 9 entries");

const supplementalImportedIds = entries
  .filter((entry) => entry.curationSet === "supplemental_2026_09_25")
  .map((entry) => entry.id);
check(
  supplementalImportedIds.length === EXPECTED_SUPPLEMENTAL_IMPORTED_IDS.size
    && supplementalImportedIds.every((id) => EXPECTED_SUPPLEMENTAL_IMPORTED_IDS.has(id)),
  "Supplemental imported ID set does not match the approved specification",
);

const priorityEntries = entries.filter((entry) => entry.curationSet === "priority_2026_09_25");
const priorityCounts = countBy(priorityEntries, "approval");
check(priorityCounts.green === 177, "Priority GREEN count must be 177");
check(priorityCounts.yellow === 40, "Priority YELLOW count must be 40");
check(priorityCounts.red === 4, "Priority RED count must be 4");

const importedOverlayCount = entries.filter((entry) => importedIds.includes(entry.id)).length;
const additionOverlayCount = entries.filter((entry) => EXPECTED_VORTIXIA_IDS.has(entry.id)).length;
const aggregateCounts = countBy(entries, "approval");
check(importedOverlayCount === 230, "Imported overlay count must be 230");
check(additionOverlayCount === 9, "Vortixia overlay count must be 9");
check(entries.length === 239, "Curated overlay total must be 239");
check(aggregateCounts.green === 188, "Aggregate GREEN count must be 188");
check(aggregateCounts.yellow === 42, "Aggregate YELLOW count must be 42");
check(aggregateCounts.red === 9, "Aggregate RED count must be 9");

for (const [id, preferredId] of EXPECTED_PREFERRED_MAPPINGS) {
  check(
    entryById.get(id)?.preferredExerciseId === preferredId,
    `${id} must prefer ${preferredId}`,
  );
}
const actualPreferredMappings = entries.filter((entry) => entry.preferredExerciseId);
check(
  actualPreferredMappings.length === EXPECTED_PREFERRED_MAPPINGS.size,
  "Unexpected preferred-ID mapping count",
);

const chestPress0576 = entryById.get("0576");
const chestPress0577 = entryById.get("0577");
check(chestPress0576?.displayName === "Plate-Loaded Chest Press", "0576 display mismatch");
check(chestPress0577?.displayName === "Machine Chest Press", "0577 display mismatch");
check(chestPress0576?.discoveryTier !== "hidden", "0576 must remain discoverable");
check(chestPress0577?.discoveryTier !== "hidden", "0577 must remain discoverable");

const pecFly = entryById.get("0596");
const pecFlyAliases = new Set((pecFly?.aliases ?? []).map(normalize));
check(pecFly?.displayName === "Machine Chest Fly", "0596 display mismatch");
check(!pecFlyAliases.has("pec deck"), "0596 must not alias Pec Deck");
check(!pecFlyAliases.has("pec fly"), "0596 must not alias Pec Fly");
for (const banned of ["reverse fly", "cable fly", "cable chest fly"]) {
  check(!pecFlyAliases.has(normalize(banned)), `0596 must not alias ${banned}`);
}

const machineReverseFly = entryById.get("0602");
const machineReverseAliases = new Set((machineReverseFly?.aliases ?? []).map(normalize));
for (const banned of ["machine chest fly", "chest fly"]) {
  check(!machineReverseAliases.has(normalize(banned)), `0602 must not alias ${banned}`);
}

const identityFixtures = new Map([
  ["0596", "Machine Chest Fly"],
  ["0602", "Machine Reverse Fly"],
  ["0188", "Cable Chest Fly"],
  ["0154", "Cable Reverse Fly"],
  ["vx_ex_face_pull", "Cable Rope Face Pull"],
  ["0225", "Standing Cable Reverse Fly"],
]);
check(identityFixtures.size === 6, "Identity fixture IDs must remain distinct");
for (const [id, displayName] of identityFixtures) {
  check(entryById.get(id)?.displayName === displayName, `${id} identity display mismatch`);
}
const facePullAliases = new Set((entryById.get("vx_ex_face_pull")?.aliases ?? []).map(normalize));
const cableRearDeltAliases = new Set((entryById.get("0225")?.aliases ?? []).map(normalize));
for (const banned of ["rear delt row", "cable rear delt row", "rear delt fly"]) {
  check(!facePullAliases.has(normalize(banned)), `Face Pull must not alias ${banned}`);
}
for (const banned of ["face pull", "cable face pull", "rope face pull"]) {
  check(!cableRearDeltAliases.has(normalize(banned)), `Cable Rear Delt Fly must not alias ${banned}`);
}

const widePulldownAliases = new Set((entryById.get("0197")?.aliases ?? []).map(normalize));
check(
  [...widePulldownAliases].some((alias) => alias.includes("wide") && alias.includes("pulldown")),
  "0197 must include wide-pulldown discovery language",
);
const battleRopeAliases = new Set((entryById.get("0128")?.aliases ?? []).map(normalize));
check(
  [...battleRopeAliases].some((alias) => alias.includes("battle") && alias.includes("rope")),
  "0128 must include battle-rope discovery language",
);

for (const id of EXPECTED_VORTIXIA_IDS) {
  check(sourceById.has(id), `${id} source record must resolve`);
  check(entryById.has(id), `${id} metadata must resolve`);
  const expected = EXPECTED_VORTIXIA_RECORDS.get(id);
  const entry = entryById.get(id);
  check(
    JSON.stringify(entry?.secondaryMuscles)
      === JSON.stringify(expected?.secondaryMuscles),
    `${id} secondary muscles differ from the approved specification`,
  );
  check(
    entry?.primaryMuscle === expected?.primaryMuscle,
    `${id} primary muscle differs from the approved specification`,
  );
}

if (errors.length > 0) {
  console.error(`Exercise catalog validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Exercise catalog validation passed.");
console.log(`- canonical SHA-256: ${catalogHash}`);
console.log(`- imported source records: ${importedExercises.length}`);
console.log(`- imported overlay entries: ${importedOverlayCount}`);
console.log(`- Vortixia additions: ${vortixiaExercises.length}`);
console.log(`- curated entries: ${entries.length}`);
console.log(`- approval counts: ${JSON.stringify(aggregateCounts)}`);
