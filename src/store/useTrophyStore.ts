import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import trophiesData from '@/data/trophies.json';

export interface Trophy {
  id: string;
  title: string;
  description: string;
  xp: number;
  icon: string;
  color: string;
  category: string;
}

export interface TrophyStore {
  unlockedTrophies: string[];
  recentUnlocks: string[];
  totalXP: number;
  
  unlockTrophy: (id: string) => void;
  clearRecentUnlocks: () => void;
  checkAchievements: (stats: { 
    isFirstWorkout?: boolean; 
    totalVolume?: number; 
    lifetimeVolume?: number;
    durationMins?: number;
    streak?: number;
    isAiGenerated?: boolean;
    sharedRoutine?: boolean;
    editedWorkout?: boolean;
  }) => void;
}

export const useTrophyStore = create<TrophyStore>()(
  persist(
    (set, get) => ({
      unlockedTrophies: [],
      recentUnlocks: [],
      totalXP: 0,

      unlockTrophy: (id: string) => {
        const { unlockedTrophies, totalXP } = get();
        if (!unlockedTrophies.includes(id)) {
          const trophy = trophiesData.find(t => t.id === id);
          if (trophy) {
            set({ 
              unlockedTrophies: [...unlockedTrophies, id],
              recentUnlocks: [...get().recentUnlocks, id],
              totalXP: totalXP + trophy.xp
            });
          }
        }
      },

      clearRecentUnlocks: () => set({ recentUnlocks: [] }),

      checkAchievements: (stats) => {
        const { unlockTrophy } = get();

        if (stats.isFirstWorkout) unlockTrophy('t_first_workout');
        if (stats.isAiGenerated) unlockTrophy('t_ai_gen');
        if (stats.streak && stats.streak >= 7) unlockTrophy('t_streak_7');
        if (stats.streak && stats.streak >= 30) unlockTrophy('t_streak_30');
        if (stats.totalVolume && stats.totalVolume >= 5000) unlockTrophy('t_vol_single');
        if (stats.lifetimeVolume && stats.lifetimeVolume >= 10000) unlockTrophy('t_vol_life');
        if (stats.durationMins && stats.durationMins < 30) unlockTrophy('t_quick');
        if (stats.editedWorkout) unlockTrophy('t_edit');
        if (stats.sharedRoutine) unlockTrophy('t_share');
      }
    }),
    {
      name: 'vortixia-trophies',
    }
  )
);
