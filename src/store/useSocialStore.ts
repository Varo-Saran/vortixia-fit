import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import { UserProfile } from './useProfileStore';

export interface LeaderboardUser extends UserProfile {
  rank: number;
}

export type DuelType = 'completion_streak' | 'volume' | 'war';
export type DuelDuration = '1_week' | '1_month' | '3_months' | '6_months';

export interface ActiveDuel {
  id: string;
  opponent: LeaderboardUser | UserProfile; // Allow basic profiles for mocked opponents
  type: DuelType;
  duration: DuelDuration;
  endDate: string;
  myScore: number;
  opponentScore: number;
  status: 'winning' | 'losing' | 'tied';
  targetScore: number; // The target XP or Volume to win
}

export interface SocialStore {
  leaderboard: LeaderboardUser[];
  activeDuels: ActiveDuel[];
  isLoading: boolean;
  fetchSocialData: () => Promise<void>;
  createDuel: (opponent: UserProfile, type: DuelType, duration: DuelDuration, targetScore: number) => void;
  updateDuelProgress: (addedVolume: number, addedXP: number) => void;
  simulateOpponent: (duelId: string, amount: number) => void;
}

export const useSocialStore = create<SocialStore>()(
  persist(
    (set, get) => ({
      leaderboard: [],
      activeDuels: [],
      isLoading: true,
      
      fetchSocialData: async () => {
        set({ isLoading: true });
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            set({ isLoading: false, leaderboard: [] });
            return;
          }
          const userId = session.user.id;

          const { data: me, error: meErr } = await supabase.from('users').select('*').eq('id', userId).single();
          if (meErr) throw meErr;

          const { data: friendships, error: friendErr } = await supabase
            .from('user_friends')
            .select('user_id, friend_id')
            .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
            .eq('status', 'accepted');
          if (friendErr) throw friendErr;

          const friendIds = friendships ? friendships.map(f => f.user_id === userId ? f.friend_id : f.user_id) : [];
          let friends: UserProfile[] = [];
          
          if (friendIds.length > 0) {
            const { data: friendsData, error: fDataErr } = await supabase.from('users').select('*').in('id', friendIds);
            if (fDataErr) throw fDataErr;
            friends = friendsData || [];
          }

          const allUsers = [me, ...friends];
          allUsers.sort((a, b) => (b.total_xp || 0) - (a.total_xp || 0));

          const leaderboard: LeaderboardUser[] = allUsers.map((u, index) => ({
            ...u,
            rank: index + 1
          }));

          set({ leaderboard, isLoading: false });
        } catch (err) {
          console.error("Error fetching social data:", err);
          set({ isLoading: false });
        }
      },

      createDuel: (opponent, type, duration, targetScore) => {
        const durationDays = duration === '1_week' ? 7 : duration === '1_month' ? 30 : duration === '3_months' ? 90 : 180;
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + durationDays);

        const newDuel: ActiveDuel = {
          id: `duel-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          opponent,
          type,
          duration,
          endDate: endDate.toISOString(),
          myScore: 0,
          opponentScore: 0,
          status: 'tied',
          targetScore
        };

        set((state) => ({
          activeDuels: [...state.activeDuels, newDuel]
        }));
      },

      updateDuelProgress: (addedVolume, addedXP) => {
        set((state) => ({
          activeDuels: state.activeDuels.map(duel => {
            const scoreToAdd = duel.type === 'volume' ? addedVolume : 
                               duel.type === 'war' ? addedXP : 
                               1; // completion_streak adds 1 day

            const newScore = duel.myScore + scoreToAdd;
            const newStatus = newScore > duel.opponentScore ? 'winning' : newScore < duel.opponentScore ? 'losing' : 'tied';

            return { ...duel, myScore: newScore, status: newStatus };
          })
        }));
      },

      simulateOpponent: (duelId, amount) => {
        set((state) => ({
          activeDuels: state.activeDuels.map(duel => {
            if (duel.id === duelId) {
              const newScore = duel.opponentScore + amount;
              const newStatus = duel.myScore > newScore ? 'winning' : duel.myScore < newScore ? 'losing' : 'tied';
              return { ...duel, opponentScore: newScore, status: newStatus };
            }
            return duel;
          })
        }));
      }
    }),
    {
      name: 'vortixia-social-storage',
      partialize: (state) => ({ activeDuels: state.activeDuels }), // only persist duels
    }
  )
);
