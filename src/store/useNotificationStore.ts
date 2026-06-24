import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface NotificationItem {
  id: string;
  type: 'friend_request' | 'duel_challenge' | 'system_alert';
  title: string;
  message: string;
  status: 'unread' | 'read';
  createdAt: string;
  avatar_url?: string;
}

export interface NotificationStore {
  notifications: NotificationItem[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  initRealtime: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  
  fetchNotifications: async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const data: NotificationItem[] = await res.json();
      
      const unreadCount = data.filter(n => n.status === 'unread').length;
      set({ notifications: data, unreadCount });
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  },

  initRealtime: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const userId = session.user.id;

    // Listen to friend requests directed at the user
    supabase
      .channel('public:user_friends_notifications')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'user_friends', 
          filter: `friend_id=eq.${userId}` 
        },
        (payload) => {
          if (payload.new.status === 'pending') {
            get().fetchNotifications();
          }
        }
      )
      .subscribe();

    // Listen to duel challenges directed at the user
    supabase
      .channel('public:duels_notifications')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'duels', 
          filter: `user_id_2=eq.${userId}` 
        },
        (payload) => {
          if (payload.new.status === 'pending') {
            get().fetchNotifications();
          }
        }
      )
      .subscribe();
  },

  markAsRead: (id) => set((state) => {
    const notifs = state.notifications.map(n => 
      n.id === id ? { ...n, status: 'read' as const } : n
    );
    return {
      notifications: notifs,
      unreadCount: notifs.filter(n => n.status === 'unread').length,
    };
  }),

  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, status: 'read' as const })),
    unreadCount: 0,
  })),
}));
