import { create } from 'zustand';
import { PlannedExercise } from './useRoutineStore';
import { useTrophyStore } from './useTrophyStore';
import { supabase } from '@/lib/supabase';

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
}

interface WorkoutStore {
  isActive: boolean;
  startTime: Date | null;
  routineName: string;
  exercises: WorkoutExercise[];
  restTimeRemaining: number;
  isResting: boolean;
  isSaving: boolean;
  lastWorkoutSummary: { totalSets: number; totalVolume: number; durationMins: number; xpEarned: number } | null;
  
  startWorkout: (routineName: string, plannedExercises: PlannedExercise[]) => void;
  finishWorkout: () => void;
  saveWorkoutToDb: () => Promise<void>;
  updateSet: (exerciseId: string, setId: string, weight: number | '', reps: number | '') => void;
  toggleSetComplete: (exerciseId: string, setId: string) => void;
  startRest: (seconds?: number) => void;
  stopRest: () => void;
  tickRest: () => void;
  addRestTime: (seconds: number) => void;
  addSet: (exerciseId: string) => void;
  addExerciseToWorkout: (exerciseName: string) => void;
  resetWorkout: () => void;
}

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  isActive: false,
  startTime: null,
  routineName: "",
  exercises: [],
  restTimeRemaining: 0,
  isResting: false,
  isSaving: false,
  lastWorkoutSummary: null,

  startWorkout: (routineName, plannedExercises) => {
    const activeExercises: WorkoutExercise[] = plannedExercises.map(ex => {
      const sets: WorkoutSet[] = Array.from({ length: ex.targetSets }).map((_, i) => ({
        id: `${ex.id}-set-${i}`,
        weight: '',
        reps: '',
        isCompleted: false,
        previousWeight: 135 + Math.floor(Math.random() * 4) * 10,
        previousReps: 10
      }));
      return {
        id: ex.id,
        name: ex.name,
        sets
      };
    });

    set({
      isActive: true,
      startTime: new Date(),
      routineName,
      exercises: activeExercises,
      restTimeRemaining: 0,
      isResting: false,
      lastWorkoutSummary: null,
    });
  },

  finishWorkout: () => {
    // Stop the workout but keep exercises for summary display
    set({ isActive: false, isResting: false, restTimeRemaining: 0 });
  },

  saveWorkoutToDb: async () => {
    const { exercises, startTime, routineName } = get();
    set({ isSaving: true });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        set({ isSaving: false });
        return;
      }

      const userId = session.user.id;
      const endTime = new Date();
      const durationMins = startTime ? Math.round((endTime.getTime() - startTime.getTime()) / 60000) : 0;

      // Calculate totals
      const completedSets = exercises.flatMap(ex =>
        ex.sets.filter(s => s.isCompleted).map(s => ({
          exerciseName: ex.name,
          setNumber: ex.sets.indexOf(s) + 1,
          weight: typeof s.weight === 'number' ? s.weight : 0,
          reps: typeof s.reps === 'number' ? s.reps : 0,
        }))
      );

      const totalSets = completedSets.length;
      const totalVolume = completedSets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
      const xpEarned = Math.round(totalSets * 50 + totalVolume * 0.1);

      // 1. Insert workout_sessions row
      const { data: sessionRow, error: sessionErr } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: userId,
          start_time: startTime?.toISOString(),
          end_time: endTime.toISOString(),
          total_volume_kg: totalVolume,
          prs_broken: 0,
        })
        .select('id')
        .single();

      if (sessionErr || !sessionRow) {
        console.error('Failed to save workout session:', sessionErr);
        set({ isSaving: false });
        return;
      }

      // 2. Batch insert workout_sets
      if (completedSets.length > 0) {
        const setsToInsert = completedSets.map(s => ({
          session_id: sessionRow.id,
          exercise_name: s.exerciseName,
          set_number: s.setNumber,
          weight: s.weight,
          reps: s.reps,
          weight_unit: 'kg',
          tracking_type: 'reps_weight',
        }));

        const { error: setsErr } = await supabase
          .from('workout_sets')
          .insert(setsToInsert);

        if (setsErr) {
          console.error('Failed to save workout sets:', setsErr);
        }
      }

      // 3. Update user XP
      const { data: currentUser } = await supabase
        .from('users')
        .select('total_xp')
        .eq('id', userId)
        .single();

      if (currentUser) {
        await supabase
          .from('users')
          .update({ total_xp: (currentUser.total_xp || 0) + xpEarned })
          .eq('id', userId);
      }

      // 4. Check trophy achievements
      useTrophyStore.getState().checkAchievements({
        totalVolume,
        durationMins,
      });

      // 5. Store summary for UI
      set({
        isSaving: false,
        lastWorkoutSummary: { totalSets, totalVolume, durationMins, xpEarned },
      });

    } catch (err) {
      console.error('Error saving workout:', err);
      set({ isSaving: false });
    }
  },

  resetWorkout: () => {
    set({
      isActive: false,
      startTime: null,
      routineName: "",
      exercises: [],
      restTimeRemaining: 0,
      isResting: false,
      isSaving: false,
      lastWorkoutSummary: null,
    });
  },

  updateSet: (exerciseId, setId, weight, reps) => {
    set(state => ({
      exercises: state.exercises.map(ex => {
        if (ex.id !== exerciseId) return ex;
        return {
          ...ex,
          sets: ex.sets.map(s => s.id === setId ? { ...s, weight, reps } : s)
        };
      })
    }));
  },

  toggleSetComplete: (exerciseId, setId) => {
    const state = get();
    let justCompleted = false;

    const newExercises = state.exercises.map(ex => {
      if (ex.id !== exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.map(s => {
          if (s.id === setId) {
            justCompleted = !s.isCompleted;
            return { ...s, isCompleted: !s.isCompleted };
          }
          return s;
        })
      };
    });

    set({ exercises: newExercises });

    if (justCompleted) {
      get().startRest(90);
    }
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
    const { restTimeRemaining } = get();
    set({ restTimeRemaining: restTimeRemaining + seconds });
  },

  addSet: (exerciseId) => {
    set(state => ({
      exercises: state.exercises.map(ex => {
        if (ex.id !== exerciseId) return ex;
        const newSetId = `${ex.id}-set-${ex.sets.length}`;
        return {
          ...ex,
          sets: [...ex.sets, {
            id: newSetId,
            weight: '',
            reps: '',
            isCompleted: false,
            previousWeight: ex.sets.length > 0 ? ex.sets[ex.sets.length - 1].previousWeight : 0,
            previousReps: ex.sets.length > 0 ? ex.sets[ex.sets.length - 1].previousReps : 0
          }]
        };
      })
    }));
  },

  addExerciseToWorkout: (exerciseName) => {
    set(state => {
      const newExId = `custom-ex-${Date.now()}`;
      const newExercise: WorkoutExercise = {
        id: newExId,
        name: exerciseName,
        sets: [{
          id: `${newExId}-set-0`,
          weight: '',
          reps: '',
          isCompleted: false,
          previousWeight: 0,
          previousReps: 0
        }]
      };
      return { exercises: [...state.exercises, newExercise] };
    });
  }
}));
