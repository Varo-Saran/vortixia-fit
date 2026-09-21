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
import { useSettingsStore } from './useSettingsStore';
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
const DEFAULT_REST_SECONDS = 90;
const MIN_REST_SECONDS = 1;
const MAX_REST_SECONDS = 60 * 60;
const WORKOUT_STORE_VERSION = 2;
const completionFlights = new Map<
  string,
  Promise<WorkoutCompletionUiOutcome>
>();

export interface WorkoutSet {
  id: string;
  weight: number | '';
  reps: number | '';
  isCompleted: boolean;
  previousWeight: number | null;
  previousReps: number | null;
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
  restEndsAt: number | null;
  restCycleId: string | null;
  pendingRestFeedbackCycleId: string | null;
  isSaving: boolean;
  operationId: string | null;
  completionRequest: WorkoutCompletionRequest | null;
  completionStatus: WorkoutCompletionStatus;
  completionError: WorkoutCompletionError;
  handledEffectOperationIds: string[];
  lastWorkoutSummary: WorkoutSummary | null;
  isSummaryDismissed: boolean;

  startWorkout: (routineName: string, plannedExercises: PlannedExercise[]) => void;
  completeWorkout: () => Promise<WorkoutCompletionUiOutcome>;
  dismissWorkoutSummary: () => void;
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
  syncRestTimer: () => void;
  consumeRestCompletionFeedback: (cycleId: string) => boolean;
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

const SETTLED_WORKOUT_LIFECYCLE = {
  isActive: false,
  isResting: false,
  restTimeRemaining: 0,
  restEndsAt: null,
  restCycleId: null,
  pendingRestFeedbackCycleId: null,
} as const;

function normalizeRestDurationSeconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_REST_SECONDS;
  }

  return Math.min(
    MAX_REST_SECONDS,
    Math.max(MIN_REST_SECONDS, Math.round(value)),
  );
}

function normalizeRemainingRestSeconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(MAX_REST_SECONDS, Math.round(value));
}

function createRestCycleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `rest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function remainingRestSeconds(restEndsAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((restEndsAt - now) / 1000));
}

function isSettledCompletionStatus(
  status: WorkoutCompletionStatus | undefined,
): status is 'queued' | 'committed' {
  return status === 'queued' || status === 'committed';
}

function migrateWorkoutStore(
  persistedState: unknown,
  storedVersion: number,
): Partial<WorkoutStore> {
  if (
    typeof persistedState !== 'object'
    || persistedState === null
    || Array.isArray(persistedState)
  ) {
    return {};
  }

  const migratedState = {
    ...(persistedState as Partial<WorkoutStore>),
  };

  if (storedVersion < 1) {
    migratedState.isSummaryDismissed = false;

    if (
      migratedState.isActive === true
      && isSettledCompletionStatus(migratedState.completionStatus)
    ) {
      Object.assign(migratedState, SETTLED_WORKOUT_LIFECYCLE);
    }
  }

  if (storedVersion < 2) {
    migratedState.pendingRestFeedbackCycleId = null;

    if (isSettledCompletionStatus(migratedState.completionStatus)) {
      Object.assign(migratedState, SETTLED_WORKOUT_LIFECYCLE);
    } else if (
      migratedState.isResting === true
    ) {
      const remainingSeconds = normalizeRemainingRestSeconds(
        migratedState.restTimeRemaining,
      );
      if (remainingSeconds > 0) {
        migratedState.restTimeRemaining = remainingSeconds;
        migratedState.restEndsAt = Date.now() + remainingSeconds * 1000;
        migratedState.restCycleId = createRestCycleId();
      } else {
        migratedState.isResting = false;
        migratedState.restTimeRemaining = 0;
        migratedState.restEndsAt = null;
        migratedState.restCycleId = null;
      }
    } else {
      migratedState.restEndsAt = null;
      migratedState.restCycleId = null;
    }
  }

  return migratedState;
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
            ...SETTLED_WORKOUT_LIFECYCLE,
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
            ...SETTLED_WORKOUT_LIFECYCLE,
            isSaving: false,
            completionStatus: 'queued',
            completionError: null,
            lastWorkoutSummary: summary,
            isSummaryDismissed: false,
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
            ...SETTLED_WORKOUT_LIFECYCLE,
            isSaving: false,
            completionStatus: 'committed',
            completionError: null,
            lastWorkoutSummary: summary,
            isSummaryDismissed: false,
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
        restEndsAt: null,
        restCycleId: null,
        pendingRestFeedbackCycleId: null,
        isSaving: false,
        operationId: null,
        completionRequest: null,
        completionStatus: 'idle',
        completionError: null,
        handledEffectOperationIds: [],
        lastWorkoutSummary: null,
        isSummaryDismissed: false,

        startWorkout: (routineName, plannedExercises) => {
          const activeExercises: WorkoutExercise[] = plannedExercises.map((exercise) => {
            const sets: WorkoutSet[] = Array.from(
              { length: exercise.targetSets },
              (_, index) => ({
                id: `${exercise.id}-set-${index}`,
                weight: '',
                reps: '',
                isCompleted: false,
                previousWeight: null,
                previousReps: null,
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
            restEndsAt: null,
            restCycleId: null,
            pendingRestFeedbackCycleId: null,
            isSaving: false,
            operationId: createWorkoutOperationId(),
            completionRequest: null,
            completionStatus: 'idle',
            completionError: null,
            lastWorkoutSummary: null,
            isSummaryDismissed: false,
          });
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

        dismissWorkoutSummary: () => {
          set({ isSummaryDismissed: true });
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
            restEndsAt: null,
            restCycleId: null,
            pendingRestFeedbackCycleId: null,
            isSaving: false,
            operationId: null,
            completionRequest: null,
            completionStatus: 'idle',
            completionError: null,
            lastWorkoutSummary: null,
            isSummaryDismissed: false,
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
          if (justCompleted) get().startRest();
        },

        startRest: (seconds) => {
          const durationSeconds = normalizeRestDurationSeconds(
            seconds ?? useSettingsStore.getState().defaultRestTimer,
          );
          set({
            isResting: true,
            restTimeRemaining: durationSeconds,
            restEndsAt: Date.now() + durationSeconds * 1000,
            restCycleId: createRestCycleId(),
            pendingRestFeedbackCycleId: null,
          });
        },

        stopRest: () => {
          set({
            isResting: false,
            restTimeRemaining: 0,
            restEndsAt: null,
            restCycleId: null,
            pendingRestFeedbackCycleId: null,
          });
        },

        syncRestTimer: () => {
          const state = get();
          if (!state.isResting) return;

          const now = Date.now();
          const cycleId = state.restCycleId ?? createRestCycleId();
          let restEndsAt = state.restEndsAt;
          if (typeof restEndsAt !== 'number' || !Number.isFinite(restEndsAt)) {
            const storedRemaining = normalizeRemainingRestSeconds(
              state.restTimeRemaining,
            );
            if (storedRemaining === 0) {
              set({
                isResting: false,
                restTimeRemaining: 0,
                restEndsAt: null,
                restCycleId: null,
                pendingRestFeedbackCycleId: null,
              });
              return;
            }
            restEndsAt = now + storedRemaining * 1000;
          }
          const remainingSeconds = remainingRestSeconds(restEndsAt, now);

          if (remainingSeconds > 0) {
            if (
              remainingSeconds !== state.restTimeRemaining
              || restEndsAt !== state.restEndsAt
              || cycleId !== state.restCycleId
            ) {
              set({
                restTimeRemaining: remainingSeconds,
                restEndsAt,
                restCycleId: cycleId,
              });
            }
            return;
          }

          set({
            isResting: false,
            restTimeRemaining: 0,
            restEndsAt: null,
            restCycleId: null,
            pendingRestFeedbackCycleId: cycleId,
          });
        },

        consumeRestCompletionFeedback: (cycleId) => {
          if (get().pendingRestFeedbackCycleId !== cycleId) return false;
          set({ pendingRestFeedbackCycleId: null });
          return true;
        },

        addRestTime: (seconds) => {
          if (!Number.isFinite(seconds)) return;

          const state = get();
          if (!state.isResting) return;

          const now = Date.now();
          const currentRemaining =
            typeof state.restEndsAt === 'number'
            && Number.isFinite(state.restEndsAt)
              ? remainingRestSeconds(state.restEndsAt, now)
              : normalizeRemainingRestSeconds(state.restTimeRemaining);
          const nextRemaining = Math.min(
            MAX_REST_SECONDS,
            currentRemaining + Math.round(seconds),
          );

          if (nextRemaining <= 0) {
            set({
              isResting: false,
              restTimeRemaining: 0,
              restEndsAt: null,
              restCycleId: null,
              pendingRestFeedbackCycleId: null,
            });
            return;
          }

          set({
            restTimeRemaining: nextRemaining,
            restEndsAt: now + nextRemaining * 1000,
            restCycleId: state.restCycleId ?? createRestCycleId(),
          });
        },

        addSet: (exerciseId) => {
          set((currentState) => ({
            exercises: currentState.exercises.map((exercise) => {
              if (exercise.id !== exerciseId) return exercise;
              return {
                ...exercise,
                sets: [...exercise.sets, {
                  id: `${exercise.id}-set-${exercise.sets.length}`,
                  weight: '',
                  reps: '',
                  isCompleted: false,
                  previousWeight: null,
                  previousReps: null,
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
                previousWeight: null,
                previousReps: null,
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
      version: WORKOUT_STORE_VERSION,
      migrate: migrateWorkoutStore,
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<WorkoutStore>),
        isSaving: false,
        isSummaryDismissed:
          (persistedState as Partial<WorkoutStore>)?.isSummaryDismissed === true,
      }),
    },
  ),
);
