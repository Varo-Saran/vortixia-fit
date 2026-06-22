import { create } from 'zustand';
import { PlannedExercise } from './useRoutineStore';
import { useTrophyStore } from './useTrophyStore';

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
  
  startWorkout: (routineName: string, plannedExercises: PlannedExercise[]) => void;
  finishWorkout: () => void;
  updateSet: (exerciseId: string, setId: string, weight: number | '', reps: number | '') => void;
  toggleSetComplete: (exerciseId: string, setId: string) => void;
  startRest: (seconds?: number) => void;
  stopRest: () => void;
  tickRest: () => void;
  addRestTime: (seconds: number) => void;
  addSet: (exerciseId: string) => void;
  addExerciseToWorkout: (exerciseName: string) => void;
}

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  isActive: false,
  startTime: null,
  routineName: "",
  exercises: [],
  restTimeRemaining: 0,
  isResting: false,

  startWorkout: (routineName, plannedExercises) => {
    // Map planned exercises to active workout exercises with empty sets
    const activeExercises: WorkoutExercise[] = plannedExercises.map(ex => {
      const sets: WorkoutSet[] = Array.from({ length: ex.targetSets }).map((_, i) => ({
        id: `${ex.id}-set-${i}`,
        weight: '',
        reps: '',
        isCompleted: false,
        // Mock previous performance
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
      isResting: false
    });
  },

  finishWorkout: () => {
    set({
      isActive: false,
      startTime: null,
      routineName: "",
      exercises: [],
      restTimeRemaining: 0,
      isResting: false
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

    // Auto-start rest timer if a set was just completed (default 90s for hypertrophy)
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
