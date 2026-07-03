import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type PlannedExercise,
  type TrackingType,
  type WeightUnit,
} from './useRoutineStore';
import { useTrophyStore } from './useTrophyStore';
import { type MuscleGroup, useRecoveryStore } from './useRecoveryStore';
import { useSocialStore } from './useSocialStore';
import { useProfileStore } from './useProfileStore';
import {
  createWorkoutCompletionRequest,
  createWorkoutOperationId,
  enqueueWorkoutCompletion,
  submitWorkoutCompletion,
} from '@/lib/workout-completion-client';
import type {
  WorkoutCompletionRequest,
  WorkoutCompletionResult,
  WorkoutCompletionSet,
} from '@/lib/workout-authority';

const MAX_HANDLED_EFFECT_OPERATIONS = 100;
const completionFlights = new Map<
  string,
  Promise<WorkoutCompletionUiOutcome>
>();

export interface WorkoutSet {
  id: string;
  weight: number | '';
  reps: number | '';
  isCompleted: boolean;
  previousWeight: number;
  previousReps: number;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  sets: WorkoutSet[];
  trackingType?: TrackingType;
  weightUnit?: WeightUnit;
}

export interface WorkoutSummary {
  operationId: string;
  sessionId?: string;
  totalSets: number;
  totalVolume: number;
  durationMins: number;
  xpEarned: number;
  totalXp?: number;
  authoritative: boolean;
  replayed?: boolean;
  syncStatus: 'committed' | 'queued';
}

export type WorkoutCompletionStatus =
  | 'idle'
  | 'saving'
  | 'queued'
  | 'committed'
  | 'terminal-error';

export type WorkoutCompletionError =
  | 'validation'
  | 'conflict'
  | 'storage'
  | null;

export type WorkoutCompletionUiOutcome =
  | {
      kind: 'committed';
      summary: WorkoutSummary;
      result: WorkoutCompletionResult;
    }
  | {
      kind: 'queued';
      summary: WorkoutSummary;
    }
  | {
      kind: 'terminal';
      reason: Exclude<WorkoutCompletionError, null>;
    };

interface WorkoutStore {
  isActive: boolean;
  startTime: string | null;
  routineName: string;
  exercises: WorkoutExercise[];
  restTimeRemaining: number;
  isResting: boolean;
  isSaving: boolean;
  operationId: string | null;
  completionRequest: WorkoutCompletionRequest | null;
  completionStatus: WorkoutCompletionStatus;
  completionError: WorkoutCompletionError;
  handledEffectOperationIds: string[];
  lastWorkoutSummary: WorkoutSummary | null;

  startWorkout: (routineName: string, plannedExercises: PlannedExercise[]) => void;
  finishWorkout: () => void;
  completeWorkout: () => Promise<WorkoutCompletionUiOutcome>;
  applyCompletionResult: (
    request: WorkoutCompletionRequest,
    result: WorkoutCompletionResult,
  ) => void;
  applyLocalEffectsOnce: (
    request: WorkoutCompletionRequest,
    summary: WorkoutSummary,
  ) => boolean;
  markLocalEffectsHandled: (operationId: string) => void;
  updateSet: (
    exerciseId: string,
    setId: string,
    weight: number | '',
    reps: number | '',
  ) => void;
  toggleSetComplete: (exerciseId: string, setId: string) => void;
  startRest: (seconds?: number) => void;
  stopRest: () => void;
  tickRest: () => void;
  addRestTime: (seconds: number) => void;
  addSet: (exerciseId: string) => void;
  addExerciseToWorkout: (exerciseName: string) => void;
  changeExerciseTracking: (
    exerciseId: string,
    trackingType: TrackingType,
    weightUnit: WeightUnit,
  ) => void;
  resetWorkout: () => void;
}

function completedSetsFromExercises(
  exercises: WorkoutExercise[],
): WorkoutCompletionSet[] {
  return exercises.flatMap((exercise) =>
    exercise.sets.flatMap((workoutSet, index) => {
      if (!workoutSet.isCompleted) return [];
      return [{
        exerciseName: exercise.name,
        setNumber: index + 1,
        weight: typeof workoutSet.weight === 'number' ? workoutSet.weight : 0,
        reps: typeof workoutSet.reps === 'number' ? workoutSet.reps : 0,
        trackingType: exercise.trackingType ?? 'reps_weight',
        weightUnit: exercise.weightUnit ?? 'kg',
        isWarmup: false,
      }];
    }),
  );
}

function provisionalSummary(
  request: WorkoutCompletionRequest,
): WorkoutSummary {
  const totalVolume = request.sets.reduce(
    (total, workoutSet) => total + workoutSet.weight * workoutSet.reps,
    0,
  );
  const durationMins = Math.round(
    (Date.parse(request.endTime) - Date.parse(request.startTime)) / 60_000,
  );
  return {
    operationId: request.operationId,
    totalSets: request.sets.length,
    totalVolume,
    durationMins,
    xpEarned: Math.round(request.sets.length * 50 + totalVolume * 0.1),
    authoritative: false,
    syncStatus: 'queued',
  };
}

function authoritativeSummary(
  result: WorkoutCompletionResult,
): WorkoutSummary {
  return {
    operationId: result.operationId,
    sessionId: result.sessionId,
    totalSets: result.totalSets,
    totalVolume: result.totalVolume,
    durationMins: result.durationMinutes,
    xpEarned: result.xpAwarded,
    totalXp: result.totalXp,
    authoritative: true,
    replayed: result.replayed,
    syncStatus: 'committed',
  };
}

function muscleForExercise(exerciseName: string): MuscleGroup {
  const name = exerciseName.toLowerCase();
  if (name.includes('bench') || name.includes('push') || name.includes('chest') || name.includes('fly')) return 'chest';
  if (name.includes('row') || name.includes('pull') || name.includes('deadlift') || name.includes('lat')) return 'back';
  if (name.includes('squat') || name.includes('leg') || name.includes('calf') || name.includes('lunge')) return 'legs';
  if (name.includes('curl') || name.includes('tricep') || name.includes('extension')) return 'arms';
  if ((name.includes('press') && name.includes('overhead')) || name.includes('raise') || name.includes('shoulder')) return 'shoulders';
  return 'core';
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => {
      const markLocalEffectsHandled = (operationId: string) => {
        const handled = get().handledEffectOperationIds;
        if (handled.includes(operationId)) return;
        set({
          handledEffectOperationIds: [...handled, operationId]
            .slice(-MAX_HANDLED_EFFECT_OPERATIONS),
        });
      };

      const applyLocalEffectsOnce = (
        request: WorkoutCompletionRequest,
        summary: WorkoutSummary,
      ): boolean => {
        if (get().handledEffectOperationIds.includes(request.operationId)) {
          return false;
        }

        // Mark first. These are local presentation effects, so at-most-once is
        // safer than duplicating fatigue or duel progress after a reload.
        markLocalEffectsHandled(request.operationId);

        useSocialStore.getState().updateDuelProgress(
          summary.totalVolume,
          summary.xpEarned,
        );

        const fatigueByMuscle = new Map<MuscleGroup, number>();
        request.sets.forEach((workoutSet) => {
          const muscle = muscleForExercise(workoutSet.exerciseName);
          fatigueByMuscle.set(muscle, (fatigueByMuscle.get(muscle) ?? 0) + 5);
        });
        fatigueByMuscle.forEach((fatigue, muscle) => {
          useRecoveryStore.getState().applyFatigue(muscle, fatigue);
        });

        useTrophyStore.getState().checkAchievements({
          isFirstWorkout: true,
          totalVolume: summary.totalVolume,
          durationMins: summary.durationMins,
          isAiGenerated:
            request.routineName.startsWith('AI')
            || request.routineName.includes('AI'),
        });
        return true;
      };

      const applyCompletionResult = (
        request: WorkoutCompletionRequest,
        result: WorkoutCompletionResult,
      ) => {
        const summary = authoritativeSummary(result);
        const state = get();
        if (
          state.operationId === request.operationId
          || state.lastWorkoutSummary?.operationId === request.operationId
        ) {
          set({
            completionStatus: 'committed',
            completionError: null,
            lastWorkoutSummary: summary,
          });
        }
        applyLocalEffectsOnce(request, summary);
        void useProfileStore.getState().fetchProfile();
      };

      const queueCompletion = (
        request: WorkoutCompletionRequest,
      ): WorkoutCompletionUiOutcome => {
        try {
          enqueueWorkoutCompletion(request);
          const summary = provisionalSummary(request);
          set({
            isSaving: false,
            completionStatus: 'queued',
            completionError: null,
            lastWorkoutSummary: summary,
          });
          applyLocalEffectsOnce(request, summary);
          return { kind: 'queued', summary };
        } catch {
          set({
            isSaving: false,
            completionStatus: 'terminal-error',
            completionError: 'storage',
          });
          return { kind: 'terminal', reason: 'storage' };
        }
      };

      const performCompletion = async (
        request: WorkoutCompletionRequest,
      ): Promise<WorkoutCompletionUiOutcome> => {
        if (!navigator.onLine) return queueCompletion(request);

        const outcome = await submitWorkoutCompletion(request);
        if (outcome.kind === 'committed') {
          const summary = authoritativeSummary(outcome.result);
          set({
            isSaving: false,
            completionStatus: 'committed',
            completionError: null,
            lastWorkoutSummary: summary,
          });
          applyLocalEffectsOnce(request, summary);
          void useProfileStore.getState().fetchProfile();
          return { kind: 'committed', summary, result: outcome.result };
        }

        if (outcome.kind === 'retryable') return queueCompletion(request);

        const reason = outcome.reason === 'conflict' ? 'conflict' : 'validation';
        set({
          isSaving: false,
          completionStatus: 'terminal-error',
          completionError: reason,
        });
        return { kind: 'terminal', reason };
      };

      return {
        isActive: false,
        startTime: null,
        routineName: '',
        exercises: [],
        restTimeRemaining: 0,
        isResting: false,
        isSaving: false,
        operationId: null,
        completionRequest: null,
        completionStatus: 'idle',
        completionError: null,
        handledEffectOperationIds: [],
        lastWorkoutSummary: null,

        startWorkout: (routineName, plannedExercises) => {
          const activeExercises: WorkoutExercise[] = plannedExercises.map((exercise) => {
            const sets: WorkoutSet[] = Array.from(
              { length: exercise.targetSets },
              (_, index) => ({
                id: `${exercise.id}-set-${index}`,
                weight: '',
                reps: '',
                isCompleted: false,
                previousWeight: 135 + Math.floor(Math.random() * 4) * 10,
                previousReps: 10,
              }),
            );
            return {
              id: exercise.id,
              name: exercise.name,
              sets,
              trackingType: exercise.trackingType,
              weightUnit: exercise.weightUnit,
            };
          });

          set({
            isActive: true,
            startTime: new Date().toISOString(),
            routineName,
            exercises: activeExercises,
            restTimeRemaining: 0,
            isResting: false,
            isSaving: false,
            operationId: createWorkoutOperationId(),
            completionRequest: null,
            completionStatus: 'idle',
            completionError: null,
            lastWorkoutSummary: null,
          });
        },

        finishWorkout: () => {
          set({ isActive: false, isResting: false, restTimeRemaining: 0 });
        },

        completeWorkout: async () => {
          const state = get();
          if (
            state.completionStatus === 'terminal-error'
            && state.completionError === 'conflict'
          ) {
            return { kind: 'terminal', reason: 'conflict' };
          }

          let operationId = state.operationId;
          if (!operationId) {
            operationId = createWorkoutOperationId();
            set({ operationId });
          }

          let request = state.completionRequest;
          if (
            !request
            || (
              state.completionStatus === 'terminal-error'
              && state.completionError === 'validation'
            )
          ) {
            const endTime = new Date().toISOString();
            try {
              request = createWorkoutCompletionRequest({
                operationId,
                startTime: state.startTime ?? endTime,
                endTime,
                routineName: state.routineName || 'Workout',
                sets: completedSetsFromExercises(state.exercises),
              });
            } catch {
              set({
                isSaving: false,
                completionStatus: 'terminal-error',
                completionError: 'validation',
              });
              return { kind: 'terminal', reason: 'validation' };
            }
            // Zustand persist writes synchronously here, before any request or
            // queue operation can observe the snapshot.
            set({ completionRequest: request });
          }

          set({
            isSaving: true,
            completionStatus: 'saving',
            completionError: null,
          });

          const existingFlight = completionFlights.get(request.operationId);
          if (existingFlight) return existingFlight;

          const flight = performCompletion(request).finally(() => {
            completionFlights.delete(request.operationId);
          });
          completionFlights.set(request.operationId, flight);
          return flight;
        },

        applyCompletionResult,
        applyLocalEffectsOnce,
        markLocalEffectsHandled,

        resetWorkout: () => {
          set({
            isActive: false,
            startTime: null,
            routineName: '',
            exercises: [],
            restTimeRemaining: 0,
            isResting: false,
            isSaving: false,
            operationId: null,
            completionRequest: null,
            completionStatus: 'idle',
            completionError: null,
            lastWorkoutSummary: null,
          });
        },

        updateSet: (exerciseId, setId, weight, reps) => {
          set((currentState) => ({
            exercises: currentState.exercises.map((exercise) => {
              if (exercise.id !== exerciseId) return exercise;
              return {
                ...exercise,
                sets: exercise.sets.map((workoutSet) =>
                  workoutSet.id === setId
                    ? { ...workoutSet, weight, reps }
                    : workoutSet,
                ),
              };
            }),
          }));
        },

        toggleSetComplete: (exerciseId, setId) => {
          let justCompleted = false;
          set((currentState) => ({
            exercises: currentState.exercises.map((exercise) => {
              if (exercise.id !== exerciseId) return exercise;
              return {
                ...exercise,
                sets: exercise.sets.map((workoutSet) => {
                  if (workoutSet.id !== setId) return workoutSet;
                  justCompleted = !workoutSet.isCompleted;
                  return { ...workoutSet, isCompleted: !workoutSet.isCompleted };
                }),
              };
            }),
          }));
          if (justCompleted) get().startRest(90);
        },

        startRest: (seconds = 90) => {
          set({ isResting: true, restTimeRemaining: seconds });
        },

        stopRest: () => {
          set({ isResting: false, restTimeRemaining: 0 });
        },

        tickRest: () => {
          const { isResting, restTimeRemaining } = get();
          if (isResting && restTimeRemaining > 0) {
            set({ restTimeRemaining: restTimeRemaining - 1 });
          } else if (restTimeRemaining === 0) {
            set({ isResting: false });
          }
        },

        addRestTime: (seconds) => {
          set({ restTimeRemaining: get().restTimeRemaining + seconds });
        },

        addSet: (exerciseId) => {
          set((currentState) => ({
            exercises: currentState.exercises.map((exercise) => {
              if (exercise.id !== exerciseId) return exercise;
              const lastSet = exercise.sets.at(-1);
              return {
                ...exercise,
                sets: [...exercise.sets, {
                  id: `${exercise.id}-set-${exercise.sets.length}`,
                  weight: '',
                  reps: '',
                  isCompleted: false,
                  previousWeight: lastSet?.previousWeight ?? 0,
                  previousReps: lastSet?.previousReps ?? 0,
                }],
              };
            }),
          }));
        },

        addExerciseToWorkout: (exerciseName) => {
          set((currentState) => {
            const exerciseId = `custom-ex-${Date.now()}`;
            const newExercise: WorkoutExercise = {
              id: exerciseId,
              name: exerciseName,
              sets: [{
                id: `${exerciseId}-set-0`,
                weight: '',
                reps: '',
                isCompleted: false,
                previousWeight: 0,
                previousReps: 0,
              }],
              trackingType: 'reps_weight',
              weightUnit: 'lbs',
            };
            return { exercises: [...currentState.exercises, newExercise] };
          });
        },

        changeExerciseTracking: (exerciseId, trackingType, weightUnit) => {
          set((currentState) => ({
            exercises: currentState.exercises.map((exercise) =>
              exercise.id === exerciseId
                ? { ...exercise, trackingType, weightUnit }
                : exercise,
            ),
          }));
        },
      };
    },
    {
      name: 'vortixia-workout-storage',
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<WorkoutStore>),
        isSaving: false,
      }),
    },
  ),
);
