export type TrackingType =
  | "reps_weight"
  | "time_weight"
  | "time_only"
  | "cardio_hr"
  | "reps_only";

export type WeightUnit = "kg" | "lbs" | "plates" | "unitless";

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type DayKind = "training" | "rest" | "recovery";

export type ExerciseSection = "warmup" | "main";

export interface PlannedExerciseOccurrence {
  id: string;
  exerciseId: string | null;
  name: string;
  targetMuscle: string;
  section: ExerciseSection;
  order: number;
  targetSets: number;
  targetValue: string;
  trackingType: TrackingType;
  weightUnit: WeightUnit;
  restSeconds: number | null;
  note?: string;
}

export interface DayPlan {
  id: string;
  weekday: Weekday;
  title: string;
  kind: DayKind;
  exercises: PlannedExerciseOccurrence[];
}

export interface RoutinePlan {
  id: string;
  name: string;
  days: DayPlan[];
}

export type NewPlannedExerciseOccurrence = Omit<
  PlannedExerciseOccurrence,
  "id" | "order"
>;

// Temporary compatibility types for the existing built-in template, AI, and
// import/export surfaces. They are converted at the store boundary and never
// used as the saved routine domain model.
export interface LegacyPlannedExercise {
  id: string;
  exerciseId?: string;
  name: string;
  targetMuscle: string;
  trackingType: TrackingType;
  weightUnit: WeightUnit;
  targetSets: number;
  targetValue: string;
  restSeconds?: number | null;
  note?: string;
  isWarmup?: boolean;
}

export interface LegacyDayPlan {
  day: string;
  shortDay: string;
  type: string;
  title: string;
  warmups: LegacyPlannedExercise[];
  mainLifts: LegacyPlannedExercise[];
}

export interface RoutineTemplate {
  id: string;
  name: string;
  description: string;
  frequency: string;
  plan: LegacyDayPlan[];
}
