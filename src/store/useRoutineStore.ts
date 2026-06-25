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
  }
];

export interface RoutineStore {
  weeklyPlan: DayPlan[];
  isLoading: boolean;
  templates: RoutineTemplate[];
  customTemplates: RoutineTemplate[];
  fetchRoutine: () => Promise<void>;
  updateDayPlan: (dayName: string, exercises: PlannedExercise[]) => void;
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
            set({ weeklyPlan: PREDEFINED_TEMPLATES[0].plan, isLoading: false });
            return;
          }

          const userId = session.user.id;

          // Try to fetch the user's active routine from Supabase
          const { data: routine, error: routineErr } = await supabase
            .from('routines')
            .select('id, name')
            .eq('user_id', userId)
            .eq('is_active', true)
            .single();

          if (routineErr || !routine) {
            // No routine in DB - use default template
            set({ weeklyPlan: PREDEFINED_TEMPLATES[0].plan, isLoading: false });
            return;
          }

          // Fetch routine days
          const { data: days, error: daysErr } = await supabase
            .from('routine_days')
            .select('id, day_name, short_day, type, title')
            .eq('routine_id', routine.id)
            .order('created_at');

          if (daysErr || !days || days.length === 0) {
            set({ weeklyPlan: PREDEFINED_TEMPLATES[0].plan, isLoading: false });
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

          set({ weeklyPlan, isLoading: false });
        } catch (err) {
          console.error('Error fetching routine:', err);
          set({ weeklyPlan: PREDEFINED_TEMPLATES[0].plan, isLoading: false });
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
      partialize: (state) => ({ customTemplates: state.customTemplates }),
    }
  )
);
