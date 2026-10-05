import type { ExerciseWeightUnit } from "@/types/exercise-catalog";
import type { CardioZone, DayKind, ExerciseSection, TrackingType, Weekday } from "@/types/routine";
import type {
  BuiltInRoutineTemplate, TemplateDay, TemplateExerciseRef, TemplateOccurrence,
} from "@/types/routine-template";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const single = (exerciseId: string): TemplateExerciseRef => ({ kind: "single", exerciseId });
const choice = (defaultExerciseId: string, ...alternativeExerciseIds: string[]): TemplateExerciseRef =>
  ({ kind: "choice", defaultExerciseId, alternativeExerciseIds });

// Reviewed programming references, not parallel exercise definitions.
const C01 = choice("0025", "0289", "0151");
const C02 = choice("0334", "0178", "0584");
const C03 = choice("0201", "0200");
const C04 = choice("0294", "0031", "0447");
const C05 = choice("0043", "0770", "0042");
const C06 = choice("0605", "0594", "1391");
const C07 = choice("0032", "0117", "0811");
const C08 = choice("0198", "0579");
const C09 = choice("0739", "vx_ex_machine_leg_press", "0760");
const C10 = choice("9003", "9001");
// C11 is deliberately SINGLE: back extension is not an interchangeable row.
const C11 = single("0861");
const C12 = choice("0447", "0294");
const C13 = choice("0043", "0770");
const C14 = choice("0599", "0586");
const C15 = choice("2141", "9003");
const C16 = choice("vx_ex_wall_slide", "vx_ex_band_pull_apart");
const C17 = choice("0031", "0447");
const C18 = choice("vx_ex_dumbbell_hip_thrust", "9004");
const ZONE_2 = choice("9003", "9001", "2141");

function occurrence(
  exercise: string | TemplateExerciseRef, targetSets: number, targetValue: string,
  trackingType: TrackingType, weightUnit: ExerciseWeightUnit, note?: string,
  section: ExerciseSection = "main",
  cardioZone: CardioZone | null = null,
): Omit<TemplateOccurrence, "order"> {
  return {
    exercise: typeof exercise === "string" ? single(exercise) : exercise,
    section, targetSets, targetValue, trackingType, weightUnit, restSeconds: null, cardioZone,
    ...(note === undefined ? {} : { note }),
  };
}

function day(
  weekday: Weekday, kind: DayKind, title: string,
  occurrences: readonly Omit<TemplateOccurrence, "order">[] = [],
): TemplateDay {
  return { weekday, kind, title, occurrences: occurrences.map((item, order) => ({ ...item, order })) };
}

const zone2 = () => occurrence(ZONE_2, 1, "30 mins", "time_only", "unitless", "Zone 2. Aerobic base building.", "main", 2);

export const BUILT_IN_ROUTINE_TEMPLATES: readonly BuiltInRoutineTemplate[] = deepFreeze([
  {
    id: "tpl_ppl_6",
    name: "Push Pull Legs (6-Day)",
    description: "High frequency hypertrophy split for advanced lifters.",
    days: [
      day("monday", "training", "Push 1", [
        occurrence(C01, 4, "8-10", "reps_weight", "kg"),
        occurrence("vx_ex_standing_barbell_overhead_press", 3, "10-12", "reps_weight", "kg"),
        occurrence(C02, 3, "15", "reps_weight", "kg"),
        occurrence(C03, 3, "12-15", "reps_weight", "plates"),
      ]),
      day("tuesday", "training", "Pull 1", [
        occurrence("0027", 4, "8-10", "reps_weight", "kg"),
        occurrence("0652", 3, "10-12", "reps_only", "unitless"),
        occurrence(C04, 3, "12", "reps_weight", "kg"),
      ]),
      day("wednesday", "training", "Legs 1", [
        occurrence(C05, 4, "8", "reps_weight", "kg"),
        occurrence("0085", 3, "10", "reps_weight", "kg"),
        occurrence(C06, 4, "15-20", "reps_weight", "plates"),
      ]),
      day("thursday", "training", "Push 2", [
        occurrence("0314", 4, "10", "reps_weight", "kg"),
        occurrence("0251", 3, "10-12", "reps_only", "unitless"),
      ]),
      day("friday", "training", "Pull 2", [
        occurrence(C07, 3, "5", "reps_weight", "kg"),
        occurrence(C08, 3, "10-12", "reps_weight", "plates"),
      ]),
      day("saturday", "training", "Legs 2", [
        occurrence(C09, 4, "12-15", "reps_weight", "kg"),
        occurrence("0585", 3, "15", "reps_weight", "plates"),
        occurrence("9008", 3, "60 secs", "time_only", "unitless"),
      ]),
      day("sunday", "recovery", "Active Recovery"),
    ],
  },
  {
    id: "tpl_bro_5",
    name: "Classic Bro Split (5-Day)",
    description: "One muscle group per day. High volume per session.",
    days: [
      day("monday", "training", "Chest Day", [occurrence(C01, 4, "8-10", "reps_weight", "kg")]),
      day("tuesday", "training", "Back Day", [occurrence("0027", 4, "8-10", "reps_weight", "kg")]),
      day("wednesday", "training", "Leg Day", [occurrence(C05, 4, "8", "reps_weight", "kg")]),
      day("thursday", "training", "Shoulder Day", [occurrence("vx_ex_standing_barbell_overhead_press", 4, "10", "reps_weight", "kg")]),
      day("friday", "training", "Arm Day", [occurrence("0031", 3, "12", "reps_weight", "kg")]),
      day("saturday", "rest", "Rest"),
      day("sunday", "rest", "Rest"),
    ],
  },
  {
    id: "tpl_int_ppl_5",
    name: "Intermediate Split (5-Day)",
    description: "Vathsaran’s signature 5-day PPL protocol featuring glute emphasis, cramp-safe core, and post-workout Zone 2 cardio.",
    days: [
      day("monday", "training", "Chest & Triceps", [
        occurrence("3666", 1, "5 min", "time_only", "unitless", "Warm-up incline walk", "warmup"),
        occurrence("vx_ex_arm_swing", 2, "15", "reps_only", "unitless", "Rotations and swings", "warmup"),
        occurrence("vx_ex_arm_circle", 2, "15", "reps_only", "unitless", "Rotations and swings", "warmup"),
        occurrence("0025", 4, "6-8", "reps_weight", "kg", "Primary compound - add weight when you hit top reps"),
        occurrence("0314", 3, "10-12", "reps_weight", "kg", "Upper chest emphasis"),
        occurrence("0596", 3, "12-15", "reps_weight", "kg", "Constant tension, peak squeeze"),
        occurrence("0158", 3, "15", "reps_weight", "kg"),
        occurrence("0200", 3, "12-15", "reps_weight", "plates"),
        occurrence("1749", 3, "10-12", "reps_weight", "kg", "Long head emphasis"),
        zone2(),
      ]),
      day("tuesday", "training", "Back & Biceps", [
        occurrence(C10, 1, "5 min", "time_only", "unitless", "Zone 1 (50-60% max HR)", "warmup", 1),
        occurrence("0197", 4, "8-10", "reps_weight", "plates", "Primary vertical pull"),
        occurrence(C11, 4, "10-12", "reps_weight", "kg"),
        occurrence("0292", 3, "10 each", "reps_weight", "kg", "Unilateral row"),
        occurrence("0588", 3, "12", "reps_weight", "kg", "Full ROM retraction"),
        occurrence("vx_ex_face_pull", 3, "15-20", "reps_weight", "plates", "Rear delts + external rotation"),
        occurrence(C12, 3, "10-12", "reps_weight", "kg"),
        occurrence("0165", 3, "12-15", "reps_weight", "plates", "Brachialis + brachioradialis"),
        zone2(),
      ]),
      day("wednesday", "training", "Cardio, Core & Glute Activation", [
        occurrence("3666", 1, "30-35 mins", "time_only", "unitless", "12-15% incline, 5.5-6.5 km/h. Zone 2.", "main", 2),
        occurrence("0175", 3, "20-25", "reps_weight", "plates", "Slow 3-second descent on every rep"),
        occurrence("0276", 3, "10 each side", "reps_only", "unitless", "Work deep TVA"),
        occurrence("0407", 3, "20 each side", "reps_weight", "kg", "Obliques"),
        occurrence("0223", 3, "20 each side", "reps_weight", "plates", "Obliques"),
        occurrence("vx_ex_bodyweight_side_plank", 3, "20-25s each side", "time_only", "unitless", "Static hold"),
        occurrence("9008", 2, "25-30s", "time_only", "unitless", "Standard plank"),
        occurrence("3013", 3, "20", "reps_only", "unitless", "1 second squeeze at top"),
        occurrence("donkey_kicks", 3, "20 each side", "reps_only", "unitless", "Controlled squeeze"),
      ]),
      day("thursday", "training", "Legs, Hamstrings & Glutes", [
        occurrence("9003", 1, "5-8 min", "time_only", "unitless", "Zone 1 easy pace", "warmup", 1),
        occurrence("3013", 2, "15", "reps_only", "unitless", "Glute activation before squats", "warmup"),
        occurrence("1564", 2, "30 seconds each side", "time_only", "unitless", "Each set: 30 seconds per side, 60 seconds total. Complete two sets.", "warmup"),
        occurrence("vx_ex_bodyweight_squat", 2, "10", "reps_only", "unitless", undefined, "warmup"),
        occurrence(C13, 4, "6-8", "reps_weight", "kg", "Primary compound"),
        occurrence(C09, 3, "12", "reps_weight", "kg", "High quad + glute volume"),
        occurrence("0085", 3, "10", "reps_weight", "kg", "Hamstring + glute primary"),
        occurrence(C14, 3, "12-15", "reps_weight", "plates"),
        occurrence("0585", 3, "15", "reps_weight", "plates"),
        occurrence("vx_ex_dumbbell_walking_lunge", 3, "12 each leg", "reps_weight", "kg"),
        occurrence(C06, 4, "20-25", "reps_weight", "plates"),
        occurrence(C18, 4, "12-15", "reps_weight", "kg", "Best single glute exercise"),
        occurrence("3645", 3, "15 each side", "reps_only", "unitless"),
        occurrence("9006", 3, "20 each side", "reps_weight", "plates"),
        occurrence("3769", 3, "12 each side", "reps_only", "unitless", "Step back diagonally"),
        zone2(),
      ]),
      day("friday", "training", "Shoulders, Biceps & Triceps", [
        occurrence(C15, 1, "5 min", "time_only", "unitless", "Zone 1 easy pace", "warmup", 1),
        occurrence(C16, 2, "12", "reps_only", "unitless", "Scapular warm-up", "warmup"),
        occurrence("vx_ex_dumbbell_ytw_raise", 2, "10 each shape", "reps_only", "unitless", "Rear delts and cuff", "warmup"),
        occurrence("0405", 4, "8-10", "reps_weight", "kg"),
        occurrence("0603", 3, "10-12", "reps_weight", "plates"),
        occurrence(C02, 4, "15-20", "reps_weight", "kg"),
        occurrence("0225", 3, "15", "reps_weight", "plates"),
        occurrence(C17, 3, "10", "reps_weight", "kg", "Superset A"),
        occurrence("0201", 3, "10", "reps_weight", "plates", "Superset B"),
        occurrence("0315", 3, "12", "reps_weight", "kg", "Superset A"),
        occurrence("1722", 3, "12", "reps_weight", "plates", "Superset B"),
        zone2(),
      ]),
      day("saturday", "recovery", "Active Recovery", [
        occurrence("9001", 1, "20-25 mins", "time_only", "unitless", "Zone 1 easy walk", "main", 1),
        occurrence("9003", 1, "20 mins", "time_only", "unitless", "Zone 1 easy spin", "main", 1),
        ...["1271", "1511", "1564", "1365", "2208", "2202"].map((id, index) =>
          occurrence(id, 1, "3 mins total", "time_only", "unitless", `Part ${index + 1}/6 of the 18-minute total recovery protocol. Three minutes total includes side changes; not three minutes per side.`)),
      ]),
      day("sunday", "rest", "Full Rest"),
    ],
  },
]);
