import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  total_xp: number;
  unclaimed_rewards?: number;
  is_admin?: boolean;
}

export interface UserMetrics {
  gender: string;
  age: number;
  weight_kg: number;
  height_cm: number;
  bmi: number;
  bmr: number;
  tdee: number;
}

export interface ProfileStore {
  profile: UserProfile | null;
  metrics: UserMetrics | null;
  isLoading: boolean;
  fetchProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useProfileStore = create<ProfileStore>((set) => ({
  profile: null,
  metrics: null,
  isLoading: true,
  
  fetchProfile: async () => {
    set({ isLoading: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        set({ isLoading: false, profile: null, metrics: null });
        return;
      }
      
      const userId = session.user.id;

      let { data: user, error: userErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (userErr && userErr.code === 'PGRST116') {
        // Row not found, create a default profile from session data
        const fallbackName = session.user.user_metadata?.full_name || 'Champion';
        const fallbackUsername = session.user.user_metadata?.preferred_username || session.user.email?.split('@')[0] || 'athlete';
        const fallbackAvatar = session.user.user_metadata?.avatar_url || '';

        const { data: newUser, error: insertErr } = await supabase
          .from('users')
          .insert({
            id: userId,
            full_name: fallbackName,
            username: fallbackUsername,
            avatar_url: fallbackAvatar,
            total_xp: 0
          })
          .select()
          .single();

        if (insertErr) {
          console.error("Failed to create missing profile", insertErr);
          // Fallback to memory-only profile if DB insert fails (e.g. RLS issues)
          user = {
            id: userId,
            full_name: fallbackName,
            username: fallbackUsername,
            avatar_url: fallbackAvatar,
            total_xp: 0
          } as any;
        } else {
          user = newUser;
        }
      } else if (userErr) {
        throw userErr;
      }

      const { data: metrics, error: metricsErr } = await supabase
        .from('user_metrics')
        .select('*')
        .eq('id', userId)
        .single();
        
      // metrics might not exist for new users, so don't throw if it's missing
      if (metricsErr && metricsErr.code !== 'PGRST116') {
        console.error("Error fetching metrics", metricsErr);
      }

      set({ profile: { ...user, unclaimed_rewards: 1 }, metrics: metrics || null, isLoading: false });
    } catch (err) {
      console.error("Error fetching profile", err);
      set({ isLoading: false });
    }
  },
  
  logout: async () => {
    await supabase.auth.signOut();
    set({ profile: null, metrics: null });
    window.location.href = '/login';
  }
}));
