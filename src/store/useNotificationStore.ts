import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface NotificationItem {
  id: string;
  type: 'friend_request' | 'duel_challenge' | 'system_alert' | 'pwa_install' | 'system_tip';
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
  dismissNotification: (id: string) => void;
  dismissAll: (ids: string[]) => void;
}

interface CacheItem {
  id: string;
  timestamp: number;
}

const CLEANUP_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const getCleanedCache = (key: string): CacheItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: CacheItem[] = JSON.parse(raw);
    const now = Date.now();
    const active = parsed.filter(item => now - item.timestamp <= CLEANUP_THRESHOLD_MS);
    if (active.length !== parsed.length) {
      localStorage.setItem(key, JSON.stringify(active));
    }
    return active;
  } catch (e) {
    console.error(`Error loading or cleaning cache for key ${key}:`, e);
    return [];
  }
};

const saveToCache = (key: string, id: string) => {
  if (typeof window === 'undefined') return;
  try {
    const active = getCleanedCache(key);
    if (!active.some(item => item.id === id)) {
      active.push({ id, timestamp: Date.now() });
      localStorage.setItem(key, JSON.stringify(active));
    }
  } catch (e) {
    console.error(`Error saving to cache for key ${key}:`, e);
  }
};

let realtimeChannels: any[] = [];

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  
  fetchNotifications: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        set({ notifications: [], unreadCount: 0 });
        return;
      }
      const userId = session.user.id;

      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const data: NotificationItem[] = await res.json();
      
      // Dynamic, user-scoped keys
      const readKey = `user_${userId}_read_ids`;
      const dismissedKey = `user_${userId}_dismissed_ids`;

      // Clean and fetch cache
      const readCache = getCleanedCache(readKey);
      const dismissedCache = getCleanedCache(dismissedKey);

      // Fetch persistent states from database users table
      const { data: userData } = await supabase
        .from('users')
        .select('read_notifications, dismissed_notifications')
        .eq('id', userId)
        .single();

      const dbRead = userData?.read_notifications || [];
      const dbDismissed = userData?.dismissed_notifications || [];

      // Combine database states with local storage cache
      const combinedRead = Array.from(new Set([...readCache.map(c => c.id), ...dbRead]));
      const combinedDismissed = Array.from(new Set([...dismissedCache.map(c => c.id), ...dbDismissed]));

      // Update local cache to match
      combinedRead.forEach(id => saveToCache(readKey, id));
      combinedDismissed.forEach(id => saveToCache(dismissedKey, id));

      const readIds = new Set(combinedRead);
      const dismissedIds = new Set(combinedDismissed);

      // Filter out dismissed notifications
      const activeNotifs = data.filter(n => !dismissedIds.has(n.id));

      // Map read status based on cache
      const mappedNotifs = activeNotifs.map(n => {
        const isRead = readIds.has(n.id) || n.status === 'read';
        return {
          ...n,
          status: (isRead ? 'read' : 'unread') as 'read' | 'unread'
        };
      });

      // Compute unread count
      const unreadCount = mappedNotifs.filter(n => n.status === 'unread').length;

      set({ notifications: mappedNotifs, unreadCount });
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  },

  initRealtime: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const userId = session.user.id;

    // Clean up existing channels to avoid duplicate subscriptions
    realtimeChannels.forEach(channel => supabase.removeChannel(channel));
    realtimeChannels = [];

    // 1. Bidirectional Realtime Listener for user_friends table
    const friendsChannel = supabase
      .channel('public:user_friends_all_changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'user_friends' 
        },
        (payload: any) => {
          const oldRow = payload.old;
          const newRow = payload.new;
          const isRelevant = 
            (newRow && (newRow.user_id === userId || newRow.friend_id === userId)) ||
            (oldRow && (oldRow.user_id === userId || oldRow.friend_id === userId));

          if (isRelevant) {
            get().fetchNotifications();
          }
        }
      )
      .subscribe();

    // 2. Bidirectional Realtime Listener for duels table
    const duelsChannel = supabase
      .channel('public:duels_all_changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'duels'
        },
        (payload: any) => {
          const oldRow = payload.old;
          const newRow = payload.new;
          const isRelevant = 
            (newRow && (newRow.challenger_id === userId || newRow.opponent_id === userId)) ||
            (oldRow && (oldRow.challenger_id === userId || oldRow.opponent_id === userId));

          if (isRelevant) {
            get().fetchNotifications();
          }
        }
      )
      .subscribe();

    realtimeChannels.push(friendsChannel, duelsChannel);
  },

  markAsRead: async (id) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const userId = session.user.id;
    const readKey = `user_${userId}_read_ids`;

    saveToCache(readKey, id);

    // Sync to database users table
    const { data: userData } = await supabase
      .from('users')
      .select('read_notifications')
      .eq('id', userId)
      .single();
    const existing = userData?.read_notifications || [];
    if (!existing.includes(id)) {
      await supabase
        .from('users')
        .update({ read_notifications: [...existing, id] })
        .eq('id', userId);
    }

    set((state) => {
      const notifs = state.notifications.map(n => 
        n.id === id ? { ...n, status: 'read' as const } : n
      );
      return {
        notifications: notifs,
        unreadCount: notifs.filter(n => n.status === 'unread').length,
      };
    });
  },

  markAllAsRead: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const userId = session.user.id;
    const readKey = `user_${userId}_read_ids`;

    const activeNotifications = get().notifications;
    activeNotifications.forEach(n => {
      if (n.status === 'unread') {
        saveToCache(readKey, n.id);
      }
    });

    // Sync all unread IDs to database users table
    const { data: userData } = await supabase
      .from('users')
      .select('read_notifications')
      .eq('id', userId)
      .single();
    const existing = userData?.read_notifications || [];
    const unreadIds = activeNotifications.filter(n => n.status === 'unread').map(n => n.id);
    const updatedRead = Array.from(new Set([...existing, ...unreadIds]));
    
    await supabase
      .from('users')
      .update({ read_notifications: updatedRead })
      .eq('id', userId);

    set((state) => ({
      notifications: state.notifications.map(n => ({ ...n, status: 'read' as const })),
      unreadCount: 0,
    }));
  },

  dismissNotification: async (id) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const userId = session.user.id;
    const dismissedKey = `user_${userId}_dismissed_ids`;

    saveToCache(dismissedKey, id);

    // Sync to database users table
    const { data: userData } = await supabase
      .from('users')
      .select('dismissed_notifications')
      .eq('id', userId)
      .single();
    const existing = userData?.dismissed_notifications || [];
    if (!existing.includes(id)) {
      await supabase
        .from('users')
        .update({ dismissed_notifications: [...existing, id] })
        .eq('id', userId);
    }

    set((state) => {
      const filtered = state.notifications.filter(n => n.id !== id);
      return {
        notifications: filtered,
        unreadCount: filtered.filter(n => n.status === 'unread').length,
      };
    });
  },

  dismissAll: async (ids) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const userId = session.user.id;
    const dismissedKey = `user_${userId}_dismissed_ids`;

    ids.forEach(id => saveToCache(dismissedKey, id));

    // Sync visible IDs dismissal to database users table
    const { data: userData } = await supabase
      .from('users')
      .select('dismissed_notifications')
      .eq('id', userId)
      .single();
    const existing = userData?.dismissed_notifications || [];
    const updatedDismissed = Array.from(new Set([...existing, ...ids]));
    
    await supabase
      .from('users')
      .update({ dismissed_notifications: updatedDismissed })
      .eq('id', userId);

    set((state) => {
      const filtered = state.notifications.filter(n => !ids.includes(n.id));
      return {
        notifications: filtered,
        unreadCount: filtered.filter(n => n.status === 'unread').length,
      };
    });
  }
}));
