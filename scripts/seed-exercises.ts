import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const exercises = [
  // Chest
  { name: 'Bench Press', muscle_group: 'chest', category: 'strength' },
  { name: 'Incline Bench Press', muscle_group: 'chest', category: 'strength' },
  { name: 'Decline Bench Press', muscle_group: 'chest', category: 'strength' },
  { name: 'Push-up', muscle_group: 'chest', category: 'strength' },
  { name: 'Dumbbell Fly', muscle_group: 'chest', category: 'strength' },
  { name: 'Cable Crossover', muscle_group: 'chest', category: 'strength' },
  { name: 'Pec Deck Machine', muscle_group: 'chest', category: 'strength' },
  { name: 'Chest Dip', muscle_group: 'chest', category: 'strength' },
  { name: 'Pullover', muscle_group: 'chest', category: 'strength' },
  { name: 'Floor Press', muscle_group: 'chest', category: 'strength' },
  { name: 'Machine Chest Press', muscle_group: 'chest', category: 'strength' },
  { name: 'Svend Press', muscle_group: 'chest', category: 'strength' },
  { name: 'Deficit Push-up', muscle_group: 'chest', category: 'strength' },
  { name: 'Spiderman Push-up', muscle_group: 'chest', category: 'strength' },
  { name: 'Close-Grip Bench Press', muscle_group: 'chest', category: 'strength' },
  
  // Back
  { name: 'Pull-up', muscle_group: 'back', category: 'strength' },
  { name: 'Chin-up', muscle_group: 'back', category: 'strength' },
  { name: 'Barbell Row', muscle_group: 'back', category: 'strength' },
  { name: 'Dumbbell Row', muscle_group: 'back', category: 'strength' },
  { name: 'Lat Pulldown', muscle_group: 'back', category: 'strength' },
  { name: 'Seated Cable Row', muscle_group: 'back', category: 'strength' },
  { name: 'T-Bar Row', muscle_group: 'back', category: 'strength' },
  { name: 'Deadlift', muscle_group: 'back', category: 'strength' },
  { name: 'Rack Pull', muscle_group: 'back', category: 'strength' },
  { name: 'Good Morning', muscle_group: 'back', category: 'strength' },
  { name: 'Hyperextension', muscle_group: 'back', category: 'strength' },
  { name: 'Straight-Arm Pulldown', muscle_group: 'back', category: 'strength' },
  { name: 'Machine Row', muscle_group: 'back', category: 'strength' },
  { name: 'Meadows Row', muscle_group: 'back', category: 'strength' },
  { name: 'Pendlay Row', muscle_group: 'back', category: 'strength' },
  { name: 'Renegade Row', muscle_group: 'back', category: 'strength' },
  { name: 'Face Pull', muscle_group: 'back', category: 'strength' },
  { name: 'Superman', muscle_group: 'back', category: 'strength' },

  // Legs
  { name: 'Squat', muscle_group: 'legs', category: 'strength' },
  { name: 'Front Squat', muscle_group: 'legs', category: 'strength' },
  { name: 'Leg Press', muscle_group: 'legs', category: 'strength' },
  { name: 'Lunge', muscle_group: 'legs', category: 'strength' },
  { name: 'Bulgarian Split Squat', muscle_group: 'legs', category: 'strength' },
  { name: 'Romanian Deadlift', muscle_group: 'legs', category: 'strength' },
  { name: 'Stiff-Leg Deadlift', muscle_group: 'legs', category: 'strength' },
  { name: 'Leg Extension', muscle_group: 'legs', category: 'strength' },
  { name: 'Leg Curl', muscle_group: 'legs', category: 'strength' },
  { name: 'Calf Raise', muscle_group: 'legs', category: 'strength' },
  { name: 'Seated Calf Raise', muscle_group: 'legs', category: 'strength' },
  { name: 'Goblet Squat', muscle_group: 'legs', category: 'strength' },
  { name: 'Hack Squat', muscle_group: 'legs', category: 'strength' },
  { name: 'Glute Bridge', muscle_group: 'legs', category: 'strength' },
  { name: 'Hip Thrust', muscle_group: 'legs', category: 'strength' },
  { name: 'Step-up', muscle_group: 'legs', category: 'strength' },
  { name: 'Sissy Squat', muscle_group: 'legs', category: 'strength' },
  { name: 'Pistol Squat', muscle_group: 'legs', category: 'strength' },
  { name: 'Sumo Deadlift', muscle_group: 'legs', category: 'strength' },
  { name: 'Box Jump', muscle_group: 'legs', category: 'strength' },

  // Arms
  { name: 'Barbell Curl', muscle_group: 'arms', category: 'strength' },
  { name: 'Dumbbell Curl', muscle_group: 'arms', category: 'strength' },
  { name: 'Hammer Curl', muscle_group: 'arms', category: 'strength' },
  { name: 'Preacher Curl', muscle_group: 'arms', category: 'strength' },
  { name: 'Concentration Curl', muscle_group: 'arms', category: 'strength' },
  { name: 'Cable Curl', muscle_group: 'arms', category: 'strength' },
  { name: 'EZ-Bar Curl', muscle_group: 'arms', category: 'strength' },
  { name: 'Triceps Pushdown', muscle_group: 'arms', category: 'strength' },
  { name: 'Overhead Triceps Extension', muscle_group: 'arms', category: 'strength' },
  { name: 'Skull Crusher', muscle_group: 'arms', category: 'strength' },
  { name: 'Triceps Dip', muscle_group: 'arms', category: 'strength' },
  { name: 'Triceps Kickback', muscle_group: 'arms', category: 'strength' },
  { name: 'Diamond Push-up', muscle_group: 'arms', category: 'strength' },
  { name: 'Zottman Curl', muscle_group: 'arms', category: 'strength' },
  { name: 'Reverse Curl', muscle_group: 'arms', category: 'strength' },
  { name: 'Wrist Curl', muscle_group: 'arms', category: 'strength' },
  { name: 'Reverse Wrist Curl', muscle_group: 'arms', category: 'strength' },

  // Shoulders
  { name: 'Overhead Press', muscle_group: 'shoulders', category: 'strength' },
  { name: 'Dumbbell Shoulder Press', muscle_group: 'shoulders', category: 'strength' },
  { name: 'Arnold Press', muscle_group: 'shoulders', category: 'strength' },
  { name: 'Lateral Raise', muscle_group: 'shoulders', category: 'strength' },
  { name: 'Front Raise', muscle_group: 'shoulders', category: 'strength' },
  { name: 'Reverse Pec Deck', muscle_group: 'shoulders', category: 'strength' },
  { name: 'Upright Row', muscle_group: 'shoulders', category: 'strength' },
  { name: 'Shrug', muscle_group: 'shoulders', category: 'strength' },
  { name: 'Push Press', muscle_group: 'shoulders', category: 'strength' },
  { name: 'Cable Lateral Raise', muscle_group: 'shoulders', category: 'strength' },
  { name: 'Machine Shoulder Press', muscle_group: 'shoulders', category: 'strength' },
  { name: 'High Pull', muscle_group: 'shoulders', category: 'strength' },
  { name: "Farmer's Walk", muscle_group: 'shoulders', category: 'strength' },

  // Core
  { name: 'Crunch', muscle_group: 'core', category: 'strength' },
  { name: 'Plank', muscle_group: 'core', category: 'strength' },
  { name: 'Russian Twist', muscle_group: 'core', category: 'strength' },
  { name: 'Hanging Leg Raise', muscle_group: 'core', category: 'strength' },
  { name: 'Bicycle Crunch', muscle_group: 'core', category: 'strength' },
  { name: 'Ab Wheel Rollout', muscle_group: 'core', category: 'strength' },
  { name: 'Sit-up', muscle_group: 'core', category: 'strength' },
  { name: 'V-up', muscle_group: 'core', category: 'strength' },
  { name: 'Flutter Kicks', muscle_group: 'core', category: 'strength' },
  { name: 'Mountain Climber', muscle_group: 'core', category: 'strength' },
  { name: 'Dead Bug', muscle_group: 'core', category: 'strength' },
  { name: 'Cable Crunch', muscle_group: 'core', category: 'strength' },
  { name: 'Reverse Crunch', muscle_group: 'core', category: 'strength' },
  { name: 'Side Plank', muscle_group: 'core', category: 'strength' },
  { name: 'Toes to Bar', muscle_group: 'core', category: 'strength' },
  { name: 'L-Sit', muscle_group: 'core', category: 'strength' },
];

async function seed() {
  console.log(`Seeding ${exercises.length} exercises...`);

  // We can just try an insert or upsert. If we map to crypto.randomUUID() and just upsert, 
  // it might create duplicates if run multiple times, unless name is uniquely constrained.
  // We will generate a deterministic UUID based on the name.
  
  const crypto = await import('crypto');
  
  function generateId(name: string) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return [
      hash.substring(0, 8),
      hash.substring(8, 12),
      '4' + hash.substring(13, 16),
      (parseInt(hash.substring(16, 17), 16) & 0x3 | 0x8).toString(16) + hash.substring(17, 20),
      hash.substring(20, 32)
    ].join('-');
  }

  const exercisesWithIds = exercises.map(ex => ({
    id: generateId(ex.name),
    ...ex
  }));

  const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
  if (authError) {
    console.log('Anonymous sign-in not enabled or failed, proceeding without auth...');
  } else {
    console.log('Signed in anonymously!');
  }

  const { data, error } = await supabase
    .from('exercises')
    .insert(exercises);

  if (error) {
    console.error('Error seeding exercises:', error);
    process.exit(1);
  }

  console.log('Successfully seeded exercises!');
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
