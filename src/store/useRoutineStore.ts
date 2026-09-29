import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BUILT_IN_ROUTINE_TEMPLATES } from '@/data/built-in-routine-templates';
import { materializeRoutineTemplate } from '@/lib/routine-templates';
import type { BuiltInRoutineTemplate } from '@/types/routine-template';
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

let routineLoadFlight: Promise<void> | null = null;

export interface RoutineStore {
  routine: RoutinePlan | null;
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  error: string | null;
  templates: readonly BuiltInRoutineTemplate[];
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
    plan: LegacyDayPlan[] | BuiltInRoutineTemplate,
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
      templates: BUILT_IN_ROUTINE_TEMPLATES,
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
                  ?? materializeRoutineTemplate(BUILT_IN_ROUTINE_TEMPLATES[0]),
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
          replacement = Array.isArray(plan)
            ? legacyPlanToRoutinePlan(
                name ?? currentState.routine.name,
                plan,
                currentState.routine.id,
              )
            : materializeRoutineTemplate(plan, currentState.routine.id);
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
        const builtIn = currentState.templates.find(
          (candidate) => candidate.id === templateId,
        );
        if (builtIn) {
          await get().replaceAndSaveRoutine(builtIn);
          return;
        }
        const template = currentState.customTemplates.find(
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
          BUILT_IN_ROUTINE_TEMPLATES[0],
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
