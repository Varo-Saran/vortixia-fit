import importedExerciseLibrary from "@/data/exerciseLibrary.json";
import exerciseMetadataJson from "@/data/exerciseMetadata.json";
import vortixiaExercisesJson from "@/data/vortixiaExercises.json";
import type {
  DiscoverableExerciseOptions,
  ExerciseMetadataFile,
  ImportedExerciseRecord,
  MachineSubtype,
  NormalizedExerciseEquipment,
  ResolvedExercise,
  VortixiaExerciseRecord,
} from "@/types/exercise-catalog";

const importedRecords = Object.freeze(
  (importedExerciseLibrary as ImportedExerciseRecord[]).map((record) =>
    Object.freeze({ ...record }),
  ),
);

const vortixiaRecords = Object.freeze(
  (vortixiaExercisesJson as VortixiaExerciseRecord[]).map((record) =>
    Object.freeze({
      ...record,
      supportedWeightUnits: Object.freeze([...record.supportedWeightUnits]),
    }),
  ),
);

const metadataFile = exerciseMetadataJson as ExerciseMetadataFile;
const metadataEntries = Object.freeze(
  metadataFile.entries.map((entry) =>
    Object.freeze({
      ...entry,
      aliases: Object.freeze([...entry.aliases]),
      secondaryMuscles: Object.freeze([...entry.secondaryMuscles]),
      reviewFlags: entry.reviewFlags
        ? Object.freeze([...entry.reviewFlags])
        : undefined,
    }),
  ),
);

const sourceRecords = Object.freeze([...importedRecords, ...vortixiaRecords]);
const sourceById = new Map(sourceRecords.map((record) => [record.id, record]));
const metadataById = new Map(metadataEntries.map((entry) => [entry.id, entry]));

function isVortixiaRecord(
  record: ImportedExerciseRecord | VortixiaExerciseRecord,
): record is VortixiaExerciseRecord {
  return "source" in record && record.source === "vortixia";
}

function normalizeEquipment(equipment: string): NormalizedExerciseEquipment {
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
}

function fallbackMachineSubtype(
  equipment: string,
): MachineSubtype | undefined {
  if (equipment === "sled machine") return "sled";
  if (equipment === "smith machine") return "smith";
  if (["leverage machine", "machine", "assisted"].includes(equipment)) {
    return "unknown";
  }
  return undefined;
}

function fallbackSecondaryMuscles(record: ImportedExerciseRecord): string[] {
  const target = record.target.toLowerCase();
  return [...new Set(
    record.muscleGroup
      .split("/")
      .map((muscle) => muscle.trim().toLowerCase())
      .filter((muscle) => muscle && muscle !== target),
  )];
}

const resolvedCatalog = Object.freeze(
  sourceRecords.map((record): ResolvedExercise => {
    const metadata = metadataById.get(record.id);
    const isVortixia = isVortixiaRecord(record);

    return Object.freeze({
      ...record,
      source: isVortixia ? "vortixia" : "imported",
      displayName: metadata?.displayName ?? record.name,
      aliases: metadata?.aliases ?? Object.freeze([]),
      normalizedEquipment:
        metadata?.normalizedEquipment ?? normalizeEquipment(record.equipment),
      machineSubtype:
        metadata?.machineSubtype ?? fallbackMachineSubtype(record.equipment),
      equipmentConfidence: metadata?.equipmentConfidence ?? "local",
      primaryMuscle: metadata?.primaryMuscle ?? record.target,
      secondaryMuscles:
        metadata?.secondaryMuscles
        ?? Object.freeze(fallbackSecondaryMuscles(record)),
      approval: metadata?.approval,
      discoveryTier: metadata?.discoveryTier ?? "extended",
      curationSet: metadata?.curationSet,
      deprecatedForDiscovery: metadata?.deprecatedForDiscovery ?? false,
      preferredExerciseId: metadata?.preferredExerciseId,
      reviewFlags: metadata?.reviewFlags ?? Object.freeze([]),
      defaultTrackingType: isVortixia
        ? record.defaultTrackingType
        : undefined,
      supportedWeightUnits: isVortixia
        ? record.supportedWeightUnits
        : undefined,
    });
  }),
);

const resolvedById = new Map(
  resolvedCatalog.map((exercise) => [exercise.id, exercise]),
);

export const EXERCISE_METADATA_VERSION = metadataFile.version;

export function getExerciseById(id: string): ResolvedExercise | undefined {
  return resolvedById.get(id);
}

export function getCanonicalExerciseById(
  id: string,
): ImportedExerciseRecord | undefined {
  return sourceById.get(id);
}

export function getPreferredExerciseId(id: string): string {
  let currentId = id;
  const visited = new Set<string>();

  while (!visited.has(currentId)) {
    visited.add(currentId);
    const preferredId = metadataById.get(currentId)?.preferredExerciseId;
    if (!preferredId) return currentId;
    currentId = preferredId;
  }

  return id;
}

export function getDiscoverableExercises(
  options: DiscoverableExerciseOptions = {},
): readonly ResolvedExercise[] {
  const { includeAdvanced = false, includeExtended = false } = options;

  return resolvedCatalog.filter((exercise) => {
    if (
      exercise.deprecatedForDiscovery
      || exercise.discoveryTier === "hidden"
    ) {
      return false;
    }
    if (exercise.discoveryTier === "priority") return true;
    if (exercise.discoveryTier === "advanced") return includeAdvanced;
    return includeExtended;
  });
}

export function getExerciseCatalog(): readonly ResolvedExercise[] {
  return resolvedCatalog;
}
