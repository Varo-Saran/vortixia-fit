import type { ExerciseWeightUnit, ResolvedExercise } from "@/types/exercise-catalog";
import type { TrackingType, Weekday } from "@/types/routine";
import type { TemplateOccurrence } from "@/types/routine-template";

// PROG06: absent imported capabilities are not universal permission. These are
// reviewed per-ID programming assertions only for this built-in template set.
const importedPairs: readonly [readonly string[], TrackingType, ExerciseWeightUnit][] = [
  [["1271", "1365", "1511", "1564", "2141", "2202", "2208", "3666", "9001", "9003", "9008"], "time_only", "unitless"],
  [["0251", "0276", "0652", "3013", "3645", "3769", "donkey_kicks"], "reps_only", "unitless"],
  [["0025", "0027", "0031", "0032", "0042", "0043", "0085", "0117", "0151", "0158", "0178", "0289", "0292", "0294", "0314", "0315", "0334", "0405", "0407", "0447", "0584", "0588", "0596", "0739", "0760", "0770", "0811", "0861", "1749", "9004"], "reps_weight", "kg"],
  [["0165", "0175", "0197", "0198", "0200", "0201", "0223", "0225", "0579", "0585", "0586", "0594", "0599", "0603", "0605", "1391", "1722", "9006"], "reps_weight", "plates"],
];

export const REVIEWED_IMPORTED_TEMPLATE_PAIRS: Readonly<Record<string, readonly [TrackingType, ExerciseWeightUnit]>> = Object.freeze(
  Object.fromEntries(importedPairs.flatMap(([ids, tracking, unit]) =>
    ids.map((id) => [id, Object.freeze([tracking, unit] as const)]),
  )),
);

export function isTemplateProgrammingCompatible(
  exercise: ResolvedExercise, tracking: TrackingType, unit: ExerciseWeightUnit,
  context: { templateId: string; weekday: Weekday; occurrence: TemplateOccurrence },
): boolean {
  const { templateId, weekday, occurrence } = context;
  // PROG04 is one prescribed warmup, never a global capability expansion.
  if (
    exercise.id === "vx_ex_dumbbell_ytw_raise"
    && templateId === "tpl_int_ppl_5" && weekday === "friday"
    && occurrence.section === "warmup" && occurrence.order === 2
    && occurrence.targetSets === 2 && occurrence.targetValue === "10 each shape"
    && tracking === "reps_only" && unit === "unitless"
  ) return true;

  if (exercise.defaultTrackingType && exercise.supportedWeightUnits) {
    return tracking === exercise.defaultTrackingType && exercise.supportedWeightUnits.includes(unit);
  }
  if (exercise.source !== "imported") return false;
  const pair = REVIEWED_IMPORTED_TEMPLATE_PAIRS[exercise.id];
  return pair !== undefined && tracking === pair[0] && unit === pair[1];
}
