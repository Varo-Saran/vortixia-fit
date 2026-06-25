import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface Friend {
  id: string;
  name: string;
  username: string;
  avatar: string;
  isOnline: boolean;
  activeRoutine?: string; // "Marathon Runner" -> "Hypertrophy Push"
  status: 'none' | 'pending' | 'friends';
}

interface FriendsStore {
  friends: Friend[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sendRequest: (id: string) => void;
  acceptRequest: (id: string) => void;
  fetchFriends: () => Promise<void>;
}

export const useFriendsStore = create<FriendsStore>((set) => ({
  friends: [],
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  sendRequest: (id) => set((state) => ({
    friends: state.friends.map(f => f.id === id ? { ...f, status: 'pending' } : f)
  })),
  acceptRequest: (id) => set((state) => ({
    friends: state.friends.map(f => f.id === id ? { ...f, status: 'friends' } : f)
  })),
  fetchFriends: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        set({ friends: [] });
        return;
      }
      const userId = session.user.id;

      const { data: rels, error: relsError } = await supabase
        .from('user_friends')
        .select('*')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');

      if (relsError) throw relsError;

      if (!rels || rels.length === 0) {
        set({ friends: [] });
        return;
      }

      const friendIds = rels.map(r => r.user_id === userId ? r.friend_id : r.user_id);

      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .in('id', friendIds);

      if (usersError) throw usersError;

      const { data: routines, error: routinesError } = await supabase
        .from('routines')
        .select('user_id, name')
        .in('user_id', friendIds)
        .eq('is_active', true);

      const routineMap = new Map<string, string>();
      if (routines && !routinesError) {
        routines.forEach(r => {
          if (r.user_id && r.name) {
            routineMap.set(r.user_id, r.name);
          }
        });
      }

      const mappedFriends: Friend[] = (users || []).map(u => {
        const charSum = u.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
        const isOnline = charSum % 3 !== 0;

        return {
          id: u.id,
          name: u.full_name || u.username || 'Athlete',
          username: u.username || 'athlete',
          avatar: u.avatar_url || '',
          isOnline,
          activeRoutine: routineMap.get(u.id) || undefined,
          status: 'friends'
        };
      });

      set({ friends: mappedFriends });
    } catch (err) {
      console.error('Error fetching friends:', err);
    }
  }
}));
