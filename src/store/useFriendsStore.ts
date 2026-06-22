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
  friends: [
    {
      id: "f1",
      name: "Henry Parkus",
      username: "@henryp",
      avatar: "https://i.pravatar.cc/150?u=henry",
      isOnline: true,
      activeRoutine: "Active Lifter",
      status: "none"
    },
    {
      id: "f2",
      name: "Tina Abraham",
      username: "@tinapower",
      avatar: "https://i.pravatar.cc/150?u=tina",
      isOnline: false,
      activeRoutine: "Powerlifter",
      status: "none"
    },
    {
      id: "f3",
      name: "Marcus Cole",
      username: "@marcus_c",
      avatar: "https://i.pravatar.cc/150?u=marcus",
      isOnline: true,
      status: "friends"
    },
    {
      id: "f4",
      name: "Sarah Jenkins",
      username: "@sarahj_lifts",
      avatar: "https://i.pravatar.cc/150?u=sarah",
      isOnline: true,
      status: "friends"
    },
    {
      id: "f5",
      name: "David Chen",
      username: "@dchen",
      avatar: "https://i.pravatar.cc/150?u=david",
      isOnline: true,
      status: "friends"
    }
  ],
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  sendRequest: (id) => set((state) => ({
    friends: state.friends.map(f => f.id === id ? { ...f, status: 'pending' } : f)
  })),
  acceptRequest: (id) => set((state) => ({
    friends: state.friends.map(f => f.id === id ? { ...f, status: 'friends' } : f)
  }))
}));
