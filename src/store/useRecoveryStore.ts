import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';

export type MuscleGroup = 'chest' | 'back' | 'legs' | 'arms' | 'core' | 'shoulders';

export interface RecoveryData {
  id: MuscleGroup;
  name: string;
  recoveryPercentage: number; // 0 to 100
}

const INITIAL_MUSCLES: RecoveryData[] = [
  { id: 'chest', name: 'Chest', recoveryPercentage: 100 },
  { id: 'back', name: 'Back', recoveryPercentage: 100 },
  { id: 'legs', name: 'Legs', recoveryPercentage: 100 },
  { id: 'arms', name: 'Arms', recoveryPercentage: 100 },
  { id: 'core', name: 'Core', recoveryPercentage: 100 },
  { id: 'shoulders', name: 'Shoulders', recoveryPercentage: 100 }
];

export interface RecoveryStore {
  readinessScore: number;
  cnsStatus: string;
  muscles: RecoveryData[];
  lastDecayTimestamp: number | null;
  
  triggerDecay: () => void;
  applyFatigue: (muscleId: MuscleGroup, fatigueAmount: number) => void;
  fastForward: (hours: number) => void; // Developer tool
  syncCnsToSupabase: () => Promise<void>;
}

const RECOVERY_PER_HOUR = 1.5; // ~36% recovery per 24h

export const useRecoveryStore = create<RecoveryStore>()(
  persist(
    (set, get) => ({
      readinessScore: 100,
      cnsStatus: 'Fresh CNS',
      muscles: INITIAL_MUSCLES,
      lastDecayTimestamp: null,

      triggerDecay: () => {
        const now = Date.now();
        const { lastDecayTimestamp, muscles } = get();

        if (!lastDecayTimestamp) {
          set({ lastDecayTimestamp: now });
          return;
        }

        const hoursPassed = (now - lastDecayTimestamp) / (1000 * 60 * 60);
        if (hoursPassed <= 0) return;

        const recoveryAmount = hoursPassed * RECOVERY_PER_HOUR;

        const newMuscles = muscles.map(m => ({
          ...m,
          recoveryPercentage: Math.min(100, m.recoveryPercentage + recoveryAmount)
        }));

        // Calculate new readiness score
        const totalRecovery = newMuscles.reduce((sum, m) => sum + m.recoveryPercentage, 0);
        const readinessScore = Math.round(totalRecovery / newMuscles.length);

        let cnsStatus = 'Fresh CNS';
        if (readinessScore < 50) cnsStatus = 'Heavily Fatigued CNS';
        else if (readinessScore < 80) cnsStatus = 'Recovering CNS';

        set({
          muscles: newMuscles,
          lastDecayTimestamp: now,
          readinessScore,
          cnsStatus
        });
        get().syncCnsToSupabase();
      },

      applyFatigue: (muscleId, fatigueAmount) => {
        const { muscles } = get();
        const newMuscles = muscles.map(m => {
          if (m.id === muscleId) {
            return {
              ...m,
              recoveryPercentage: Math.max(0, m.recoveryPercentage - fatigueAmount)
            };
          }
          return m;
        });

        const totalRecovery = newMuscles.reduce((sum, m) => sum + m.recoveryPercentage, 0);
        const readinessScore = Math.round(totalRecovery / newMuscles.length);

        let cnsStatus = 'Fresh CNS';
        if (readinessScore < 50) cnsStatus = 'Heavily Fatigued CNS';
        else if (readinessScore < 80) cnsStatus = 'Recovering CNS';

        set({
          muscles: newMuscles,
          readinessScore,
          cnsStatus
        });
        get().syncCnsToSupabase();
      },

      fastForward: (hours: number) => {
        const { lastDecayTimestamp } = get();
        // Move the last timestamp BACK in time by `hours` to simulate passing time
        const simulatedPastTimestamp = (lastDecayTimestamp || Date.now()) - (hours * 60 * 60 * 1000);
        set({ lastDecayTimestamp: simulatedPastTimestamp });
        get().triggerDecay();
      },

      syncCnsToSupabase: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          const { readinessScore } = get();
          await supabase
            .from('users')
            .update({ cns_readiness: readinessScore })
            .eq('id', session.user.id);
        } catch (err) {
          console.error('Failed to sync CNS readiness to Supabase:', err);
        }
      },
    }),
    {
      name: 'vortixia-recovery-storage',
    }
  )
);
