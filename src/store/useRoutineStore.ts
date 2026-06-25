import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';

// New flexible tracking schemas
export type TrackingType = 'reps_weight' | 'time_weight' | 'time_only' | 'cardio_hr' | 'reps_only';
export type WeightUnit = 'kg' | 'lbs' | 'plates' | 'unitless';

export interface PlannedExercise {
  id: string;
  exerciseId?: string; // Links to global library
  name: string;
  targetMuscle: string;
  trackingType: TrackingType;
  weightUnit: WeightUnit;
  targetSets: number;
  targetValue: string; // e.g., "8-10 reps", "60 secs", "Zone 2"
  note?: string;
  isWarmup?: boolean;
}

export interface DayPlan {
  day: string;
  shortDay: string;
  type: string;
  title: string;
  warmups: PlannedExercise[];
  mainLifts: PlannedExercise[];
}

export interface RoutineTemplate {
  id: string;
  name: string;
  description: string;
  frequency: string;
  plan: DayPlan[];
}

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

export interface RoutineStore {
  weeklyPlan: DayPlan[];
  isLoading: boolean;
  templates: RoutineTemplate[];
  customTemplates: RoutineTemplate[];
  fetchRoutine: () => Promise<void>;
  updateDayPlan: (dayName: string, exercises: PlannedExercise[]) => void;
  saveRoutineToDb: () => Promise<void>;
  loadTemplate: (templateId: string) => void;
  exportRoutine: () => string;
  importRoutine: (base64Str: string) => boolean;
  applyAiRoutine: (plan: DayPlan[]) => void;
  saveCustomTemplate: (name: string, description: string, plan: DayPlan[]) => boolean;
  deleteCustomTemplate: (templateId: string) => void;
  resetActiveSplit: () => void;
  clearAllCustomTemplates: () => void;
}

export const useRoutineStore = create<RoutineStore>()(
  persist(
    (set, get) => ({
      weeklyPlan: [],
      isLoading: true,
      templates: PREDEFINED_TEMPLATES,
      customTemplates: [],
      
      fetchRoutine: async () => {
        set({ isLoading: true });
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            const localPlan = get().weeklyPlan;
            if (localPlan && localPlan.length > 0) {
              set({ weeklyPlan: localPlan, isLoading: false });
            } else {
              set({ weeklyPlan: PREDEFINED_TEMPLATES[0].plan, isLoading: false });
            }
            return;
          }

          const userId = session.user.id;

          // Try to fetch the user's active routine from Supabase
          const { data: routine, error: routineErr } = await supabase
            .from('routines')
            .select('id, name')
            .eq('user_id', userId)
            .eq('is_active', true)
            .maybeSingle();

          if (routineErr || !routine) {
            // No routine in DB - fallback to local plan or default
            const localPlan = get().weeklyPlan;
            if (localPlan && localPlan.length > 0) {
              set({ weeklyPlan: localPlan, isLoading: false });
            } else {
              set({ weeklyPlan: PREDEFINED_TEMPLATES[0].plan, isLoading: false });
            }
            return;
          }

          // Fetch routine days
          const { data: days, error: daysErr } = await supabase
            .from('routine_days')
            .select('id, day_name, short_day, type, title')
            .eq('routine_id', routine.id)
            .order('created_at');

          if (daysErr || !days || days.length === 0) {
            const localPlan = get().weeklyPlan;
            if (localPlan && localPlan.length > 0) {
              set({ weeklyPlan: localPlan, isLoading: false });
            } else {
              set({ weeklyPlan: PREDEFINED_TEMPLATES[0].plan, isLoading: false });
            }
            return;
          }

          // Fetch all planned exercises for these days
          const dayIds = days.map(d => d.id);
          const { data: exercises, error: exErr } = await supabase
            .from('planned_exercises')
            .select('*')
            .in('routine_day_id', dayIds)
            .order('order_index');

          // Build the weekly plan
          const weeklyPlan: DayPlan[] = days.map(day => {
            const dayExercises = (exercises || []).filter(ex => ex.routine_day_id === day.id);
            const mainLifts: PlannedExercise[] = dayExercises
              .filter(ex => !ex.is_warmup)
              .map(ex => ({
                id: ex.id,
                name: ex.name,
                targetMuscle: ex.type || 'unknown',
                trackingType: (ex.tracking_style || 'reps_weight') as TrackingType,
                weightUnit: 'kg' as WeightUnit,
                targetSets: ex.target_sets,
                targetValue: ex.target_reps,
                note: ex.note || undefined,
                isWarmup: false,
              }));
            const warmups: PlannedExercise[] = dayExercises
              .filter(ex => ex.is_warmup)
              .map(ex => ({
                id: ex.id,
                name: ex.name,
                targetMuscle: ex.type || 'unknown',
                trackingType: (ex.tracking_style || 'reps_weight') as TrackingType,
                weightUnit: 'kg' as WeightUnit,
                targetSets: ex.target_sets,
                targetValue: ex.target_reps,
                isWarmup: true,
              }));

            return {
              day: day.day_name,
              shortDay: day.short_day,
              type: day.type,
              title: day.title,
              warmups,
              mainLifts,
            };
          });

          // Sort weeklyPlan by standard day order
          const DAY_ORDER: Record<string, number> = {
            Monday: 0,
            Tuesday: 1,
            Wednesday: 2,
            Thursday: 3,
            Friday: 4,
            Saturday: 5,
            Sunday: 6
          };
          weeklyPlan.sort((a, b) => (DAY_ORDER[a.day] ?? 0) - (DAY_ORDER[b.day] ?? 0));

          set({ weeklyPlan, isLoading: false });
        } catch (err) {
          console.error('Error fetching routine:', err);
          const localPlan = get().weeklyPlan;
          if (localPlan && localPlan.length > 0) {
            set({ weeklyPlan: localPlan, isLoading: false });
          } else {
            set({ weeklyPlan: PREDEFINED_TEMPLATES[0].plan, isLoading: false });
          }
        }
      },

      updateDayPlan: (dayName, exercises) => set((state) => {
        const newPlan = [...state.weeklyPlan];
        const index = newPlan.findIndex(p => p.day === dayName);
        if (index !== -1) {
          newPlan[index] = { ...newPlan[index], mainLifts: exercises };
        }
        return { weeklyPlan: newPlan };
      }),

      saveRoutineToDb: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          const userId = session.user.id;
          const weeklyPlan = get().weeklyPlan;

          // 1. Get or create active routine
          let { data: routine, error: routineErr } = await supabase
            .from('routines')
            .select('id')
            .eq('user_id', userId)
            .eq('is_active', true)
            .maybeSingle();

          if (routineErr) {
            console.error('Error fetching routine for sync:', routineErr);
            return;
          }

          if (!routine) {
            const { data: newRoutine, error: createErr } = await supabase
              .from('routines')
              .insert({
                user_id: userId,
                name: 'My Routine',
                is_active: true
              })
              .select('id')
              .single();

            if (createErr || !newRoutine) {
              console.error('Error creating routine for sync:', createErr);
              return;
            }
            routine = newRoutine;
          }

          // 2. Fetch existing days to clean them up
          const { data: existingDays, error: fetchDaysErr } = await supabase
            .from('routine_days')
            .select('id')
            .eq('routine_id', routine.id);

          if (fetchDaysErr) {
            console.error('Error fetching existing days:', fetchDaysErr);
            return;
          }

          if (existingDays && existingDays.length > 0) {
            const dayIds = existingDays.map(d => d.id);
            // Delete exercises first
            const { error: delExErr } = await supabase
              .from('planned_exercises')
              .delete()
              .in('routine_day_id', dayIds);
            
            if (delExErr) {
              console.error('Error deleting old planned exercises:', delExErr);
              return;
            }
          }

          // Delete routine days
          const { error: delDaysErr } = await supabase
            .from('routine_days')
            .delete()
            .eq('routine_id', routine.id);

          if (delDaysErr) {
            console.error('Error deleting old routine days:', delDaysErr);
            return;
          }

          // 3. Bulk insert new days
          const daysToInsert = weeklyPlan.map(day => ({
            routine_id: routine.id,
            day_name: day.day,
            short_day: day.shortDay,
            type: day.type,
            title: day.title
          }));

          const { data: insertedDays, error: daysErr } = await supabase
            .from('routine_days')
            .insert(daysToInsert)
            .select('id, day_name');

          if (daysErr || !insertedDays) {
            console.error('Error inserting routine days:', daysErr);
            return;
          }

          // 4. Bulk insert planned exercises
          const exercisesToInsert: any[] = [];
          insertedDays.forEach(dayRow => {
            const localDay = weeklyPlan.find(d => d.day === dayRow.day_name);
            if (!localDay) return;

            const warmups = (localDay.warmups || []).map((ex, index) => ({
              routine_day_id: dayRow.id,
              name: ex.name,
              type: ex.targetMuscle,
              tracking_style: ex.trackingType,
              target_sets: ex.targetSets,
              target_reps: ex.targetValue,
              note: ex.note || null,
              is_warmup: true,
              order_index: index
            }));

            const mainLifts = (localDay.mainLifts || []).map((ex, index) => ({
              routine_day_id: dayRow.id,
              name: ex.name,
              type: ex.targetMuscle,
              tracking_style: ex.trackingType,
              target_sets: ex.targetSets,
              target_reps: ex.targetValue,
              note: ex.note || null,
              is_warmup: false,
              order_index: (localDay.warmups || []).length + index
            }));

            exercisesToInsert.push(...warmups, ...mainLifts);
          });

          if (exercisesToInsert.length > 0) {
            const { error: exErr } = await supabase
              .from('planned_exercises')
              .insert(exercisesToInsert);
            if (exErr) {
              console.error('Error inserting planned exercises:', exErr);
            }
          }
        } catch (err) {
          console.error('Unhandled error in saveRoutineToDb:', err);
        }
      },

      loadTemplate: (templateId: string) => {
        const template = get().templates.find(t => t.id === templateId) || get().customTemplates.find(t => t.id === templateId);
        if (template) {
          set({ weeklyPlan: template.plan });
        }
      },

      applyAiRoutine: (plan: DayPlan[]) => set({ weeklyPlan: plan }),

      exportRoutine: () => {
        const plan = get().weeklyPlan;
        try {
          const jsonStr = JSON.stringify(plan);
          return btoa(encodeURIComponent(jsonStr));
        } catch (e) {
          console.error("Failed to export routine", e);
          return "";
        }
      },

      importRoutine: (base64Str: string) => {
        try {
          const jsonStr = decodeURIComponent(atob(base64Str));
          const plan = JSON.parse(jsonStr) as DayPlan[];
          if (Array.isArray(plan) && plan.length === 7) {
            set({ weeklyPlan: plan });
            return true;
          }
          return false;
        } catch (e) {
          console.error("Failed to import routine", e);
          return false;
        }
      },

      saveCustomTemplate: (name, description, plan) => {
        const { customTemplates } = get();
        if (customTemplates.length >= 15) {
          return false; // Rate limit exceeded
        }
        const activeDaysCount = plan.filter(p => p.type !== 'Rest' && p.mainLifts.length > 0).length;
        const newTemplate: RoutineTemplate = {
          id: `cust_${Date.now()}`,
          name,
          description: description || "Custom workout plan saved in app.",
          frequency: `${activeDaysCount || plan.filter(p => p.type !== 'Rest').length} days/week`,
          plan
        };
        set({ customTemplates: [...customTemplates, newTemplate] });
        return true;
      },

      deleteCustomTemplate: (templateId) => {
        set({
          customTemplates: get().customTemplates.filter(t => t.id !== templateId)
        });
      },

      resetActiveSplit: () => {
        set({ weeklyPlan: PREDEFINED_TEMPLATES[0].plan });
      },

      clearAllCustomTemplates: () => {
        set({ customTemplates: [] });
      }
    }),
    {
      name: 'vortixia-custom-templates-storage',
      partialize: (state) => ({
        customTemplates: state.customTemplates,
        weeklyPlan: state.weeklyPlan,
      }),
    }
  )
);
