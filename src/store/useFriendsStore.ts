import { create } from 'zustand';

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
  }))
}));
