import exerciseLibrary from '@/data/exerciseLibrary.json';
// Using crypto.randomUUID() instead of uuid package
import { PlannedExercise } from '@/store/useRoutineStore';

export type GoalType = 'hypertrophy' | 'strength' | 'endurance';
export type SplitType = 'ppl' | 'bro_split' | 'upper_lower' | 'full_body';

interface Scheme {
  sets: number;
  reps: number; // Target Value
}

const SCHEMES: Record<GoalType, Scheme> = {
  hypertrophy: { sets: 4, reps: 12 },
  strength: { sets: 5, reps: 5 },
  endurance: { sets: 3, reps: 20 },
};

// Muscle mapping from Split days to what exerciseLibrary uses (target or bodyPart)
const SPLITS: Record<SplitType, Record<string, string[]>> = {
  ppl: {
    Push: ['chest', 'triceps', 'delts', 'shoulders'],
    Pull: ['back', 'biceps', 'lats'],
    Legs: ['quads', 'glutes', 'hamstrings', 'calves']
  },
  bro_split: {
    Chest: ['chest'],
    Back: ['back', 'lats'],
    Arms: ['biceps', 'triceps'],
    Shoulders: ['delts', 'shoulders'],
    Legs: ['quads', 'glutes', 'hamstrings', 'calves']
  },
  upper_lower: {
    Upper: ['chest', 'back', 'lats', 'shoulders', 'delts', 'biceps', 'triceps'],
    Lower: ['quads', 'glutes', 'hamstrings', 'calves']
  },
  full_body: {
    FullBody: ['chest', 'back', 'quads', 'shoulders', 'biceps', 'triceps', 'hamstrings']
  }
};

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generateRoutine(goal: GoalType, split: SplitType) {
  const scheme = SCHEMES[goal];
  const splitDef = SPLITS[split];
  const routine: Record<string, PlannedExercise[]> = {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: []
  };

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const splitKeys = Object.keys(splitDef);
  
  // Decide how many times to loop the split over 7 days.
  // Bro split = 5 days usually. PPL = 6 days. Upper/Lower = 4 days. Full body = 3 days.
  let assignedDays = 0;
  
  // Custom logic to distribute days with rest days
  let distribution: string[] = [];
  if (split === 'bro_split') {
    // 5 days on, 2 days off (Sat, Sun off)
    distribution = [splitKeys[0], splitKeys[1], splitKeys[2], splitKeys[3], splitKeys[4], 'Rest', 'Rest'];
  } else if (split === 'ppl') {
    // PPL PPL Rest
    distribution = ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Rest'];
  } else if (split === 'upper_lower') {
    // Upper Lower Rest Upper Lower Rest Rest
    distribution = ['Upper', 'Lower', 'Rest', 'Upper', 'Lower', 'Rest', 'Rest'];
  } else if (split === 'full_body') {
    // FB Rest FB Rest FB Rest Rest
    distribution = ['FullBody', 'Rest', 'FullBody', 'Rest', 'FullBody', 'Rest', 'Rest'];
  }

  distribution.forEach((dayType, index) => {
    const dayName = daysOfWeek[index];
    if (dayType === 'Rest') return; // Empty array remains

    const targetMuscles = splitDef[dayType as keyof typeof splitDef] || [];
    
    // Filter library for these muscles
    const availableExercises = exerciseLibrary.filter((ex: any) => 
      targetMuscles.some(m => ex.target?.toLowerCase().includes(m) || ex.bodyPart?.toLowerCase().includes(m))
    );

    // Shuffle to get a random assortment
    const shuffled = shuffleArray(availableExercises);
    
    // Pick 5-6 exercises per day
    const selected = shuffled.slice(0, 5);

    selected.forEach((ex: any, i) => {
      routine[dayName].push({
        id: `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        exerciseId: ex.id || ex.name,
        name: ex.name,
        targetSets: scheme.sets,
        targetValue: scheme.reps.toString(),
        trackingType: 'reps_weight',
        weightUnit: 'kg',
        targetMuscle: ex.target || ex.bodyPart || "full body"
      });
    });
  });

  return routine;
}
