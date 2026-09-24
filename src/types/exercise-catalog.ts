export type ExerciseApproval = "green" | "yellow" | "red";

export type ExerciseDiscoveryTier =
  | "priority"
  | "advanced"
  | "extended"
  | "hidden";

export type NormalizedExerciseEquipment =
  | "barbell"
  | "dumbbell"
  | "ez_bar"
  | "cable"
  | "machine"
  | "smith_machine"
  | "sled_machine"
  | "bodyweight"
  | "band"
  | "kettlebell"
  | "cardio_machine"
  | "other";

export type MachineSubtype =
  | "selectorized"
  | "plate_loaded"
  | "leverage"
  | "sled"
  | "smith"
  | "unknown";

export type ExerciseEvidenceConfidence =
  | "local"
  | "corroborated_external"
  | "conservative"
  | "review_required";

export type ExerciseReviewFlag =
  | "asset"
  | "mechanism"
  | "movement_identity"
  | "target_metadata"
  | "discovery"
  | "license";

export type ExerciseTrackingType =
  | "reps_weight"
  | "time_weight"
  | "time_only"
  | "cardio_hr"
  | "reps_only";

export type ExerciseWeightUnit = "kg" | "lb" | "plates" | "unitless";

export type ExerciseCurationSet =
  | "priority_2026_09_25"
  | "supplemental_2026_09_25"
  | "vortixia_addition_2026_09_25";

export interface ImportedExerciseRecord {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  muscleGroup: string;
}

export interface VortixiaExerciseRecord extends ImportedExerciseRecord {
  id: `vx_ex_${string}`;
  source: "vortixia";
  defaultTrackingType: ExerciseTrackingType;
  supportedWeightUnits: readonly ExerciseWeightUnit[];
}

export interface ExerciseMetadataOverlay {
  id: string;
  displayName?: string;
  aliases: readonly string[];
  normalizedEquipment: NormalizedExerciseEquipment;
  machineSubtype?: MachineSubtype;
  equipmentConfidence: ExerciseEvidenceConfidence;
  primaryMuscle: string;
  secondaryMuscles: readonly string[];
  approval: ExerciseApproval;
  discoveryTier: ExerciseDiscoveryTier;
  curationSet: ExerciseCurationSet;
  deprecatedForDiscovery?: boolean;
  preferredExerciseId?: string;
  reviewFlags?: readonly ExerciseReviewFlag[];
}

export interface ExerciseMetadataFile {
  version: number;
  entries: readonly ExerciseMetadataOverlay[];
}

export interface ResolvedExercise extends ImportedExerciseRecord {
  source: "imported" | "vortixia";
  displayName: string;
  aliases: readonly string[];
  normalizedEquipment: NormalizedExerciseEquipment;
  machineSubtype?: MachineSubtype;
  equipmentConfidence: ExerciseEvidenceConfidence;
  primaryMuscle: string;
  secondaryMuscles: readonly string[];
  approval?: ExerciseApproval;
  discoveryTier: ExerciseDiscoveryTier;
  curationSet?: ExerciseCurationSet;
  deprecatedForDiscovery: boolean;
  preferredExerciseId?: string;
  reviewFlags: readonly ExerciseReviewFlag[];
  defaultTrackingType?: ExerciseTrackingType;
  supportedWeightUnits?: readonly ExerciseWeightUnit[];
}

export interface DiscoverableExerciseOptions {
  includeAdvanced?: boolean;
  includeExtended?: boolean;
}
