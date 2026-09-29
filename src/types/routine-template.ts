import type { ExerciseWeightUnit } from "@/types/exercise-catalog";
import type { DayKind, ExerciseSection, TrackingType, Weekday } from "@/types/routine";

export type TemplateExerciseRef =
  | { readonly kind: "single"; readonly exerciseId: string }
  | {
      readonly kind: "choice";
      readonly defaultExerciseId: string;
      readonly alternativeExerciseIds: readonly string[];
    };

export interface TemplateOccurrence {
  readonly exercise: TemplateExerciseRef;
  readonly section: ExerciseSection;
  readonly order: number;
  readonly targetSets: number;
  readonly targetValue: string;
  readonly trackingType?: TrackingType;
  // Blueprint units use catalog vocabulary; materialization translates lb to lbs.
  readonly weightUnit?: ExerciseWeightUnit;
  readonly restSeconds?: number | null;
  readonly note?: string;
}

export interface TemplateDay {
  readonly weekday: Weekday;
  readonly title: string;
  readonly kind: DayKind;
  readonly occurrences: readonly TemplateOccurrence[];
}

export interface BuiltInRoutineTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly days: readonly TemplateDay[];
}
