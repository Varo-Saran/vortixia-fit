import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  createOccurrence,
  createRoutineUuid,
  legacyPlanToRoutinePlan,
  normalizeRoutineName,
  reorderOccurrences,
  routinePlanToLegacyPlan,
} from '@/lib/routine-model';
import {
  loadActiveRoutine,
  saveActiveRoutine,
} from '@/lib/routine-persistence';
import type {
  LegacyDayPlan,
  NewPlannedExerciseOccurrence,
  PlannedExerciseOccurrence,
  RoutinePlan,
  RoutineTemplate,
  Weekday,
} from '@/types/routine';

export type {
  DayKind,
  LegacyDayPlan,
  LegacyPlannedExercise,
  NewPlannedExerciseOccurrence,
  PlannedExerciseOccurrence,
  RoutinePlan,
  RoutineTemplate,
  TrackingType,
  Weekday,
  WeightUnit,
} from '@/types/routine';

// --- Predefined Templates using new schema ---
const PREDEFINED_TEMPLATES: RoutineTemplate[] = [
  {
    id: "tpl_ppl_6",
    name: "Push Pull Legs (6-Day)",
    description: "High frequency hypertrophy split for advanced lifters.",
    frequency: "6 days/week",
    plan: [
      { day: "Monday", shortDay: "M", type: "Push", title: "Push 1", warmups: [], mainLifts: [
        { id: "e1", name: "Bench Press", targetMuscle: "chest", trackingType: "reps_weight", weightUnit: "kg", targetSets: 4, targetValue: "8-10" },
        { id: "e2", name: "Overhead Press", targetMuscle: "shoulders", trackingType: "reps_weight", weightUnit: "kg", targetSets: 3, targetValue: "10-12" },
        { id: "e2a", name: "Lateral Raises", targetMuscle: "shoulders", trackingType: "reps_weight", weightUnit: "unitless", targetSets: 3, targetValue: "15" },
        { id: "e2b", name: "Tricep Pushdown", targetMuscle: "triceps", trackingType: "reps_weight", weightUnit: "plates", targetSets: 3, targetValue: "12-15" }
      ]},
      { day: "Tuesday", shortDay: "T", type: "Pull", title: "Pull 1", warmups: [], mainLifts: [
        { id: "e3", name: "Barbell Row", targetMuscle: "lats", trackingType: "reps_weight", weightUnit: "kg", targetSets: 4, targetValue: "8-10" },
        { id: "e4", name: "Pull-ups", targetMuscle: "lats", trackingType: "reps_only", weightUnit: "unitless", targetSets: 3, targetValue: "10-12" },
        { id: "e4a", name: "Bicep Curls", targetMuscle: "biceps", trackingType: "reps_weight", weightUnit: "unitless", targetSets: 3, targetValue: "12" }
      ]},
      { day: "Wednesday", shortDay: "W", type: "Legs", title: "Legs 1", warmups: [], mainLifts: [
        { id: "e5", name: "Squat", targetMuscle: "quads", trackingType: "reps_weight", weightUnit: "kg", targetSets: 4, targetValue: "8" },
        { id: "e6", name: "Romanian Deadlift", targetMuscle: "hamstrings", trackingType: "reps_weight", weightUnit: "kg", targetSets: 3, targetValue: "10" },
        { id: "e6a", name: "Calf Raises", targetMuscle: "calves", trackingType: "reps_weight", weightUnit: "plates", targetSets: 4, targetValue: "15-20" }
      ]},
      { day: "Thursday", shortDay: "T", type: "Push", title: "Push 2", warmups: [], mainLifts: [
        { id: "e7", name: "Incline DB Press", targetMuscle: "chest", trackingType: "reps_weight", weightUnit: "unitless", targetSets: 4, targetValue: "10" },
        { id: "e7a", name: "Dips", targetMuscle: "chest", trackingType: "reps_only", weightUnit: "unitless", targetSets: 3, targetValue: "10-12" }
      ]},
      { day: "Friday", shortDay: "F", type: "Pull", title: "Pull 2", warmups: [], mainLifts: [
        { id: "e8", name: "Deadlift", targetMuscle: "lower back", trackingType: "reps_weight", weightUnit: "kg", targetSets: 3, targetValue: "5" },
        { id: "e8a", name: "Lat Pulldown", targetMuscle: "lats", trackingType: "reps_weight", weightUnit: "plates", targetSets: 3, targetValue: "10-12" }
      ]},
      { day: "Saturday", shortDay: "S", type: "Legs", title: "Legs 2", warmups: [], mainLifts: [
        { id: "e9", name: "Leg Press", targetMuscle: "quads", trackingType: "reps_weight", weightUnit: "plates", targetSets: 4, targetValue: "12-15" },
        { id: "e9a", name: "Leg Extensions", targetMuscle: "quads", trackingType: "reps_weight", weightUnit: "plates", targetSets: 3, targetValue: "15" },
        { id: "e9b", name: "Plank", targetMuscle: "abs", trackingType: "time_only", weightUnit: "unitless", targetSets: 3, targetValue: "60 secs" }
      ]},
      { day: "Sunday", shortDay: "S", type: "Rest", title: "Active Recovery", warmups: [], mainLifts: []}
    ]
  },
  {
    id: "tpl_bro_5",
    name: "Classic Bro Split (5-Day)",
    description: "One muscle group per day. High volume per session.",
    frequency: "5 days/week",
    plan: [
      { day: "Monday", shortDay: "M", type: "Chest", title: "Chest Day", warmups: [], mainLifts: [
        { id: "e1", name: "Bench Press", targetMuscle: "chest", trackingType: "reps_weight", weightUnit: "kg", targetSets: 4, targetValue: "8-10" }
      ]},
      { day: "Tuesday", shortDay: "T", type: "Back", title: "Back Day", warmups: [], mainLifts: [
        { id: "e4", name: "Barbell Row", targetMuscle: "lats", trackingType: "reps_weight", weightUnit: "kg", targetSets: 4, targetValue: "8-10" }
      ]},
      { day: "Wednesday", shortDay: "W", type: "Legs", title: "Leg Day", warmups: [], mainLifts: [
        { id: "e7", name: "Squat", targetMuscle: "quads", trackingType: "reps_weight", weightUnit: "kg", targetSets: 4, targetValue: "8" }
      ]},
      { day: "Thursday", shortDay: "T", type: "Shoulders", title: "Shoulder Day", warmups: [], mainLifts: [
        { id: "e10", name: "Overhead Press", targetMuscle: "shoulders", trackingType: "reps_weight", weightUnit: "kg", targetSets: 4, targetValue: "10" }
      ]},
      { day: "Friday", shortDay: "F", type: "Arms", title: "Arm Day", warmups: [], mainLifts: [
        { id: "e13", name: "Barbell Curl", targetMuscle: "biceps", trackingType: "reps_weight", weightUnit: "kg", targetSets: 3, targetValue: "12" }
      ]},
      { day: "Saturday", shortDay: "S", type: "Rest", title: "Rest", warmups: [], mainLifts: []},
      { day: "Sunday", shortDay: "S", type: "Rest", title: "Rest", warmups: [], mainLifts: []}
    ]
  },
  {
    id: "tpl_int_ppl_5",
    name: "Intermediate Split (5-Day)",
    description: "Vathsaran's signature 5-day PPL protocol featuring glute emphasis, cramp-safe core, and post-workout Zone 2 cardio.",
    frequency: "5 days/week",
    plan: [
      {
        day: "Monday",
        shortDay: "M",
        type: "Push",
        title: "Chest & Triceps",
        warmups: [
          { id: "int_mon_w1", name: "Treadmill Incline Walk", targetMuscle: "legs", trackingType: "time_only", weightUnit: "unitless", targetSets: 1, targetValue: "5 min", note: "Warm-up incline walk", isWarmup: true },
          { id: "int_mon_w2", name: "Arm Swings + Shoulder Rotations", targetMuscle: "shoulders", trackingType: "reps_only", weightUnit: "unitless", targetSets: 2, targetValue: "15", note: "Rotations and swings", isWarmup: true }
        ],
        mainLifts: [
          { id: "int_mon_m1", name: "Flat Barbell Bench Press", targetMuscle: "chest", trackingType: "reps_weight", weightUnit: "kg", targetSets: 4, targetValue: "6-8", note: "Primary compound - add weight when you hit top reps" },
          { id: "int_mon_m2", name: "Incline Dumbbell Press", targetMuscle: "chest", trackingType: "reps_weight", weightUnit: "kg", targetSets: 3, targetValue: "10-12", note: "Upper chest emphasis" },
          { id: "int_mon_m3", name: "Machine Chest Fly / Pec Deck", targetMuscle: "chest", trackingType: "reps_weight", weightUnit: "kg", targetSets: 3, targetValue: "12-15", note: "Constant tension, peak squeeze" },
          { id: "int_mon_m4", name: "Cable Crossover (high to low)", targetMuscle: "chest", trackingType: "reps_weight", weightUnit: "kg", targetSets: 3, targetValue: "15" },
          { id: "int_mon_m5", name: "Tricep Rope Pushdown", targetMuscle: "triceps", trackingType: "reps_weight", weightUnit: "plates", targetSets: 3, targetValue: "12-15" },
          { id: "int_mon_m6", name: "Overhead EZ-Bar Tricep Extension", targetMuscle: "triceps", trackingType: "reps_weight", weightUnit: "kg", targetSets: 3, targetValue: "10-12", note: "Long head emphasis" },
          { id: "int_mon_m7", name: "Zone 2 Cardio", targetMuscle: "heart", trackingType: "time_only", weightUnit: "unitless", targetSets: 1, targetValue: "30 mins", note: "Aerobic base building" }
        ]
      },
      {
        day: "Tuesday",
        shortDay: "T",
        type: "Pull",
        title: "Back & Biceps",
        warmups: [
          { id: "int_tue_w1", name: "Stationary Bike / Treadmill Walk", targetMuscle: "legs", trackingType: "time_only", weightUnit: "unitless", targetSets: 1, targetValue: "5 min", note: "Zone 1 (50-60% max HR)", isWarmup: true }
        ],
        mainLifts: [
          { id: "int_tue_m1", name: "Lat Pulldown (wide grip)", targetMuscle: "lats", trackingType: "reps_weight", weightUnit: "plates", targetSets: 4, targetValue: "8-10", note: "Primary vertical pull" },
          { id: "int_tue_m2", name: "Seated Cable Row / Back Extension", targetMuscle: "lats", trackingType: "reps_weight", weightUnit: "kg", targetSets: 4, targetValue: "10-12", note: "Alternate depending on station availability" },
          { id: "int_tue_m3", name: "Dumbbell Single-Arm Row", targetMuscle: "lats", trackingType: "reps_weight", weightUnit: "kg", targetSets: 3, targetValue: "10 each", note: "Unilateral row" },
          { id: "int_tue_m4", name: "Machine Low Row (neutral grip)", targetMuscle: "lats", trackingType: "reps_weight", weightUnit: "kg", targetSets: 3, targetValue: "12", note: "Full ROM retraction" },
          { id: "int_tue_m5", name: "Face Pulls", targetMuscle: "shoulders", trackingType: "reps_weight", weightUnit: "plates", targetSets: 3, targetValue: "15-20", note: "Rear delts + external rotation" },
          { id: "int_tue_m6", name: "EZ-Bar or Dumbbell Curl", targetMuscle: "biceps", trackingType: "reps_weight", weightUnit: "kg", targetSets: 3, targetValue: "10-12" },
          { id: "int_tue_m7", name: "Cable Hammer Curl", targetMuscle: "biceps", trackingType: "reps_weight", weightUnit: "plates", targetSets: 3, targetValue: "12-15", note: "Brachialis + brachioradialis" },
          { id: "int_tue_m8", name: "Zone 2 Cardio", targetMuscle: "heart", trackingType: "time_only", weightUnit: "unitless", targetSets: 1, targetValue: "30 mins", note: "Aerobic base building" }
        ]
      },
      {
        day: "Wednesday",
        shortDay: "W",
        type: "Cardio",
        title: "Cardio, Core & Glute Activation",
        warmups: [],
        mainLifts: [
          { id: "int_wed_m1", name: "Treadmill Incline Walk", targetMuscle: "legs", trackingType: "time_only", weightUnit: "unitless", targetSets: 1, targetValue: "30-35 mins", note: "12-15% incline, 5.5-6.5 km/h. Zone 2." },
          { id: "int_wed_m2", name: "Cable Crunch", targetMuscle: "abs", trackingType: "reps_weight", weightUnit: "plates", targetSets: 3, targetValue: "20-25", note: "Slow 3-second descent on every rep" },
          { id: "int_wed_m3", name: "Dead Bug", targetMuscle: "abs", trackingType: "reps_only", weightUnit: "unitless", targetSets: 3, targetValue: "10 each side", note: "Work deep TVA" },
          { id: "int_wed_m4", name: "Dumbbell Side Bend", targetMuscle: "abs", trackingType: "reps_weight", weightUnit: "kg", targetSets: 3, targetValue: "20 each side", note: "Obliques" },
          { id: "int_wed_m5", name: "Standing Cable Oblique Crunch", targetMuscle: "abs", trackingType: "reps_weight", weightUnit: "plates", targetSets: 3, targetValue: "20 each side", note: "Obliques" },
          { id: "int_wed_m6", name: "Side Plank", targetMuscle: "abs", trackingType: "time_only", weightUnit: "unitless", targetSets: 3, targetValue: "20-25s each side", note: "Static hold" },
          { id: "int_wed_m7", name: "Plank", targetMuscle: "abs", trackingType: "time_only", weightUnit: "unitless", targetSets: 2, targetValue: "25-30s", note: "Standard plank" },
          { id: "int_wed_m8", name: "Glute Bridge", targetMuscle: "glutes", trackingType: "reps_only", weightUnit: "unitless", targetSets: 3, targetValue: "20", note: "1 second squeeze at top" },
          { id: "int_wed_m9", name: "Donkey Kick", targetMuscle: "glutes", trackingType: "reps_only", weightUnit: "unitless", targetSets: 3, targetValue: "20 each side", note: "Controlled squeeze" }
        ]
      },
      {
        day: "Thursday",
        shortDay: "T",
        type: "Legs",
        title: "Legs, Hamstrings & Glutes",
        warmups: [
          { id: "int_thu_w1", name: "Stationary Bike", targetMuscle: "legs", trackingType: "time_only", weightUnit: "unitless", targetSets: 1, targetValue: "5-8 min", note: "Zone 1 easy pace", isWarmup: true },
          { id: "int_thu_w2", name: "Bodyweight Glute Bridge", targetMuscle: "glutes", trackingType: "reps_only", weightUnit: "unitless", targetSets: 2, targetValue: "15", note: "Glute activation before squats", isWarmup: true },
          { id: "int_thu_w3", name: "Hip Flexor Stretch + Bodyweight Squat", targetMuscle: "legs", trackingType: "reps_only", weightUnit: "unitless", targetSets: 2, targetValue: "10", isWarmup: true }
        ],
        mainLifts: [
          { id: "int_thu_m1", name: "Barbell Squat / Smith Machine Squat", targetMuscle: "quads", trackingType: "reps_weight", weightUnit: "kg", targetSets: 4, targetValue: "6-8", note: "Primary compound" },
          { id: "int_thu_m2", name: "Leg Press", targetMuscle: "quads", trackingType: "reps_weight", weightUnit: "plates", targetSets: 3, targetValue: "12", note: "High quad + glute volume" },
          { id: "int_thu_m3", name: "Romanian Deadlift", targetMuscle: "hamstrings", trackingType: "reps_weight", weightUnit: "kg", targetSets: 3, targetValue: "10", note: "Hamstring + glute primary" },
          { id: "int_thu_m4", name: "Seated Leg Curl / Lying Leg Curl", targetMuscle: "hamstrings", trackingType: "reps_weight", weightUnit: "plates", targetSets: 3, targetValue: "12-15" },
          { id: "int_thu_m5", name: "Leg Extension", targetMuscle: "quads", trackingType: "reps_weight", weightUnit: "plates", targetSets: 3, targetValue: "15" },
          { id: "int_thu_m6", name: "Dumbbell Walking Lunges", targetMuscle: "quads", trackingType: "reps_weight", weightUnit: "kg", targetSets: 3, targetValue: "12 each leg" },
          { id: "int_thu_m7", name: "Calf Raises", targetMuscle: "calves", trackingType: "reps_weight", weightUnit: "plates", targetSets: 4, targetValue: "20-25" },
          { id: "int_thu_m8", name: "Dumbbell/Barbell Hip Thrust", targetMuscle: "glutes", trackingType: "reps_weight", weightUnit: "kg", targetSets: 4, targetValue: "12-15", note: "Best single glute exercise" },
          { id: "int_thu_m9", name: "Single-Leg Glute Bridge", targetMuscle: "glutes", trackingType: "reps_only", weightUnit: "unitless", targetSets: 3, targetValue: "15 each side" },
          { id: "int_thu_m10", name: "Cable Kickback / Donkey Kick", targetMuscle: "glutes", trackingType: "reps_weight", weightUnit: "plates", targetSets: 3, targetValue: "20 each side" },
          { id: "int_thu_m11", name: "Curtsy Lunge", targetMuscle: "glutes", trackingType: "reps_only", weightUnit: "unitless", targetSets: 3, targetValue: "12 each side", note: "Step back diagonally" },
          { id: "int_thu_m12", name: "Zone 2 Cardio", targetMuscle: "heart", trackingType: "time_only", weightUnit: "unitless", targetSets: 1, targetValue: "30 mins", note: "Aerobic base building" }
        ]
      },
      {
        day: "Friday",
        shortDay: "F",
        type: "Arms",
        title: "Shoulders, Biceps & Triceps",
        warmups: [
          { id: "int_fri_w1", name: "Elliptical / Stationary Bike", targetMuscle: "legs", trackingType: "time_only", weightUnit: "unitless", targetSets: 1, targetValue: "5 min", note: "Zone 1 easy pace", isWarmup: true },
          { id: "int_fri_w2", name: "Wall Slides / Band Pull-Aparts", targetMuscle: "shoulders", trackingType: "reps_only", weightUnit: "unitless", targetSets: 2, targetValue: "12", note: "Scapular warm-up", isWarmup: true },
          { id: "int_fri_w3", name: "Light Dumbbell YTW Raises", targetMuscle: "shoulders", trackingType: "reps_only", weightUnit: "unitless", targetSets: 2, targetValue: "10 each shape", note: "Rear delts and cuff", isWarmup: true }
        ],
        mainLifts: [
          { id: "int_fri_m1", name: "Dumbbell Overhead Press (seated)", targetMuscle: "shoulders", trackingType: "reps_weight", weightUnit: "kg", targetSets: 4, targetValue: "8-10" },
          { id: "int_fri_m2", name: "Machine Shoulder Press", targetMuscle: "shoulders", trackingType: "reps_weight", weightUnit: "plates", targetSets: 3, targetValue: "10-12" },
          { id: "int_fri_m3", name: "Lateral Raise", targetMuscle: "shoulders", trackingType: "reps_weight", weightUnit: "kg", targetSets: 4, targetValue: "15-20" },
          { id: "int_fri_m4", name: "Cable Rear Delt Fly", targetMuscle: "shoulders", trackingType: "reps_weight", weightUnit: "plates", targetSets: 3, targetValue: "15" },
          { id: "int_fri_m5", name: "Barbell or EZ-Bar Curl", targetMuscle: "biceps", trackingType: "reps_weight", weightUnit: "kg", targetSets: 3, targetValue: "10", note: "Superset A" },
          { id: "int_fri_m6", name: "Cable Tricep Pushdown", targetMuscle: "triceps", trackingType: "reps_weight", weightUnit: "plates", targetSets: 3, targetValue: "10", note: "Superset B" },
          { id: "int_fri_m7", name: "Incline Dumbbell Curl", targetMuscle: "biceps", trackingType: "reps_weight", weightUnit: "kg", targetSets: 3, targetValue: "12", note: "Superset A" },
          { id: "int_fri_m8", name: "Overhead Cable Tricep Extension", targetMuscle: "triceps", trackingType: "reps_weight", weightUnit: "plates", targetSets: 3, targetValue: "12", note: "Superset B" },
          { id: "int_fri_m9", name: "Zone 2 Cardio", targetMuscle: "heart", trackingType: "time_only", weightUnit: "unitless", targetSets: 1, targetValue: "30 mins", note: "Aerobic base building" }
        ]
      },
      {
        day: "Saturday",
        shortDay: "S",
        type: "Rest",
        title: "Active Recovery",
        warmups: [],
        mainLifts: [
          { id: "int_sat_m1", name: "Treadmill Walk (flat, easy)", targetMuscle: "legs", trackingType: "time_only", weightUnit: "unitless", targetSets: 1, targetValue: "20-25 mins", note: "Zone 1 easy walk" },
          { id: "int_sat_m2", name: "Stationary Bike (easy spin)", targetMuscle: "legs", trackingType: "time_only", weightUnit: "unitless", targetSets: 1, targetValue: "20 mins", note: "Zone 1 easy spin" },
          { id: "int_sat_m3", name: "Full-Body Stretching + Foam Rolling", targetMuscle: "flexibility", trackingType: "time_only", weightUnit: "unitless", targetSets: 1, targetValue: "15-20 mins" }
        ]
      },
      {
        day: "Sunday",
        shortDay: "S",
        type: "Rest",
        title: "Full Rest",
        warmups: [],
        mainLifts: []
      }
    ]
  }
];

let routineLoadFlight: Promise<void> | null = null;

export interface RoutineStore {
  routine: RoutinePlan | null;
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  error: string | null;
  templates: RoutineTemplate[];
  customTemplates: RoutineTemplate[];
  fetchRoutine: () => Promise<void>;
  setRoutine: (routine: RoutinePlan) => void;
  setRoutineName: (name: string) => void;
  updateDayMetadata: (
    weekday: Weekday,
    updates: Partial<Pick<RoutinePlan["days"][number], "title" | "kind">>,
  ) => void;
  addOccurrence: (
    weekday: Weekday,
    occurrence: NewPlannedExerciseOccurrence,
  ) => void;
  updateOccurrence: (
    occurrenceId: string,
    updates: Partial<Omit<PlannedExerciseOccurrence, "id">>,
  ) => void;
  removeOccurrence: (occurrenceId: string) => void;
  reorderDayOccurrences: (weekday: Weekday, orderedIds: string[]) => void;
  saveRoutineToDb: () => Promise<void>;
  replaceAndSaveRoutine: (
    plan: LegacyDayPlan[],
    name?: string,
  ) => Promise<void>;
  applyTemplate: (templateId: string) => Promise<void>;
  exportRoutine: () => string;
  importRoutine: (base64Str: string) => Promise<void>;
  applyAiRoutine: (plan: LegacyDayPlan[]) => Promise<void>;
  saveCustomTemplate: (
    name: string,
    description: string,
    plan: LegacyDayPlan[] | RoutinePlan,
  ) => boolean;
  deleteCustomTemplate: (templateId: string) => void;
  resetActiveSplit: () => Promise<void>;
  clearAllCustomTemplates: () => void;
}

export const useRoutineStore = create<RoutineStore>()(
  persist(
    (set, get) => ({
      routine: null,
      loadStatus: 'idle',
      isLoading: false,
      isSaving: false,
      isDirty: false,
      error: null,
      templates: PREDEFINED_TEMPLATES,
      customTemplates: [],
      
      fetchRoutine: async () => {
        const currentState = get();
        if (currentState.isDirty && currentState.routine) {
          return;
        }

        if (routineLoadFlight) {
          return routineLoadFlight;
        }

        routineLoadFlight = (async () => {
          set({ loadStatus: 'loading', isLoading: true, error: null });
          try {
            const loadedRoutine = await loadActiveRoutine();
            set((state) => {
              if (state.isDirty && state.routine) {
                return {
                  loadStatus: 'ready',
                  isLoading: false,
                  error: null,
                };
              }

              return {
                routine:
                  loadedRoutine
                  ?? legacyPlanToRoutinePlan(
                    PREDEFINED_TEMPLATES[0].name,
                    PREDEFINED_TEMPLATES[0].plan,
                  ),
                loadStatus: 'ready',
                isLoading: false,
                isDirty: false,
                error: null,
              };
            });
          } catch (error) {
            const message = error instanceof Error
              ? error.message
              : 'Unable to load the active routine.';
            console.error('Error fetching routine:', error);
            set((state) => {
              if (state.isDirty && state.routine) {
                return {
                  loadStatus: 'ready',
                  isLoading: false,
                  error: message,
                };
              }

              return {
                routine: null,
                loadStatus: 'error',
                isLoading: false,
                isDirty: false,
                error: message,
              };
            });
          }
        })();

        try {
          await routineLoadFlight;
        } finally {
          routineLoadFlight = null;
        }
      },

      setRoutine: (routine) => set({
        routine,
        loadStatus: 'ready',
        isDirty: true,
        error: null,
      }),

      setRoutineName: (name) => set((state) => ({
        routine: state.routine
          ? { ...state.routine, name }
          : state.routine,
        isDirty: state.routine ? true : state.isDirty,
        error: null,
      })),

      updateDayMetadata: (weekday, updates) => set((state) => ({
        routine: state.routine
          ? {
              ...state.routine,
              days: state.routine.days.map((day) =>
                day.weekday === weekday ? { ...day, ...updates } : day,
              ),
            }
          : state.routine,
        isDirty: state.routine ? true : state.isDirty,
        error: null,
      })),

      addOccurrence: (weekday, occurrence) => set((state) => ({
        routine: state.routine
          ? {
              ...state.routine,
              days: state.routine.days.map((day) =>
                day.weekday === weekday
                  ? {
                      ...day,
                      exercises: [
                        ...day.exercises,
                        createOccurrence(occurrence, day.exercises.length),
                      ],
                    }
                  : day,
              ),
            }
          : state.routine,
        isDirty: state.routine ? true : state.isDirty,
        error: null,
      })),

      updateOccurrence: (occurrenceId, updates) => set((state) => ({
        routine: state.routine
          ? {
              ...state.routine,
              days: state.routine.days.map((day) => ({
                ...day,
                exercises: day.exercises.map((exercise) =>
                  exercise.id === occurrenceId
                    ? { ...exercise, ...updates, id: exercise.id }
                    : exercise,
                ),
              })),
            }
          : state.routine,
        isDirty: state.routine ? true : state.isDirty,
        error: null,
      })),

      removeOccurrence: (occurrenceId) => set((state) => ({
        routine: state.routine
          ? {
              ...state.routine,
              days: state.routine.days.map((day) => ({
                ...day,
                exercises: day.exercises
                  .filter((exercise) => exercise.id !== occurrenceId)
                  .map((exercise, order) => ({ ...exercise, order })),
              })),
            }
          : state.routine,
        isDirty: state.routine ? true : state.isDirty,
        error: null,
      })),

      reorderDayOccurrences: (weekday, orderedIds) => set((state) => ({
        routine: state.routine
          ? {
              ...state.routine,
              days: state.routine.days.map((day) =>
                day.weekday === weekday
                  ? {
                      ...day,
                      exercises: reorderOccurrences(day.exercises, orderedIds),
                    }
                  : day,
              ),
            }
          : state.routine,
        isDirty: state.routine ? true : state.isDirty,
        error: null,
      })),

      saveRoutineToDb: async () => {
        const { routine, loadStatus } = get();
        if (!routine || loadStatus !== 'ready') {
          const error = new Error(
            'A verified routine draft is required before saving.',
          );
          set({ error: error.message });
          throw error;
        }

        set({ isSaving: true, error: null });
        try {
          const savedRoutine = await saveActiveRoutine(routine);
          set({
            routine: savedRoutine,
            loadStatus: 'ready',
            isSaving: false,
            isDirty: false,
            error: null,
          });
        } catch (error) {
          const message = error instanceof Error
            ? error.message
            : 'Unable to save the routine.';
          console.error('Error saving routine:', error);
          set({ isSaving: false, isDirty: true, error: message });
          throw error;
        }
      },

      replaceAndSaveRoutine: async (plan, name) => {
        let currentState = get();
        if (currentState.isSaving) {
          const error = new Error('A routine save is already in progress.');
          set({ error: error.message });
          throw error;
        }

        if (
          currentState.loadStatus === 'idle'
          || currentState.loadStatus === 'loading'
        ) {
          await get().fetchRoutine();
          currentState = get();
        }

        if (currentState.loadStatus !== 'ready' || !currentState.routine) {
          const error = new Error(
            'Load the saved routine successfully before replacing it.',
          );
          set({ error: error.message });
          throw error;
        }
        if (currentState.isSaving) {
          const error = new Error('A routine save is already in progress.');
          set({ error: error.message });
          throw error;
        }

        let replacement: RoutinePlan;
        try {
          replacement = legacyPlanToRoutinePlan(
            name ?? currentState.routine.name,
            plan,
            currentState.routine.id,
          );
        } catch (error) {
          const message = error instanceof Error
            ? error.message
            : 'The replacement routine is invalid.';
          set({ error: message });
          throw error;
        }

        set({
          routine: replacement,
          loadStatus: 'ready',
          isDirty: true,
          error: null,
        });
        await get().saveRoutineToDb();
      },

      applyTemplate: async (templateId: string) => {
        const currentState = get();
        const template = currentState.templates.find(
          (candidate) => candidate.id === templateId,
        ) ?? currentState.customTemplates.find(
          (candidate) => candidate.id === templateId,
        );
        if (!template) {
          const error = new Error('The selected routine template is unavailable.');
          set({ error: error.message });
          throw error;
        }

        await get().replaceAndSaveRoutine(template.plan, template.name);
      },

      applyAiRoutine: async (plan) => {
        await get().replaceAndSaveRoutine(plan);
      },

      exportRoutine: () => {
        const routine = get().routine;
        if (!routine) return '';
        try {
          const jsonStr = JSON.stringify(routinePlanToLegacyPlan(routine));
          return btoa(encodeURIComponent(jsonStr));
        } catch (e) {
          console.error("Failed to export routine", e);
          return "";
        }
      },

      importRoutine: async (base64Str: string) => {
        let plan: LegacyDayPlan[];
        try {
          const jsonStr = decodeURIComponent(atob(base64Str));
          const parsed = JSON.parse(jsonStr) as unknown;
          if (!Array.isArray(parsed) || parsed.length !== 7) {
            throw new Error('The imported routine must contain seven days.');
          }
          plan = parsed as LegacyDayPlan[];
        } catch (error) {
          const message = error instanceof Error
            ? error.message
            : 'Unable to parse the imported routine.';
          console.error('Failed to import routine', error);
          set({ error: message });
          throw error;
        }

        await get().replaceAndSaveRoutine(plan, 'Imported Routine');
      },

      saveCustomTemplate: (name, description, plan) => {
        const { customTemplates } = get();
        if (customTemplates.length >= 15) {
          return false; // Rate limit exceeded
        }
        const legacyPlan = Array.isArray(plan)
          ? plan
          : routinePlanToLegacyPlan(plan);
        const activeDaysCount = legacyPlan.filter(
          (day) => day.type !== 'Rest' && day.mainLifts.length > 0,
        ).length;
        const newTemplate: RoutineTemplate = {
          id: `cust_${createRoutineUuid()}`,
          name: normalizeRoutineName(name),
          description: description || "Custom workout plan saved in app.",
          frequency: `${activeDaysCount || legacyPlan.filter(p => p.type !== 'Rest').length} days/week`,
          plan: legacyPlan,
        };
        set({ customTemplates: [...customTemplates, newTemplate] });
        return true;
      },

      deleteCustomTemplate: (templateId) => {
        set({
          customTemplates: get().customTemplates.filter(t => t.id !== templateId)
        });
      },

      resetActiveSplit: async () => {
        await get().replaceAndSaveRoutine(
          PREDEFINED_TEMPLATES[0].plan,
          PREDEFINED_TEMPLATES[0].name,
        );
      },

      clearAllCustomTemplates: () => {
        set({ customTemplates: [] });
      }
    }),
    {
      name: 'vortixia-custom-templates-storage',
      version: 1,
      migrate: () => ({ customTemplates: [] }),
      partialize: (state) => ({
        customTemplates: state.customTemplates,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        customTemplates:
          (persistedState as Partial<RoutineStore>)?.customTemplates ?? [],
      }),
    }
  )
);
