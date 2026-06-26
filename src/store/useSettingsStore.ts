import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';

interface SettingsStore {
  heroGender: 'male' | 'female';
  weightUnit: 'kg' | 'lbs';
  heightUnit: 'cm' | 'in';
  timeFormat: '12h' | '24h';
  defaultRestTimer: number; // default rest timer in seconds
  soundEffects: boolean;
  hapticFeedback: boolean;
  notifyWorkouts: boolean;
  notifySocial: boolean;
  notifyInactivity: boolean;
  isSynced: boolean;

  setHeroGender: (gender: 'male' | 'female') => void;
  setWeightUnit: (unit: 'kg' | 'lbs') => void;
  setHeightUnit: (unit: 'cm' | 'in') => void;
  setTimeFormat: (format: '12h' | '24h') => void;
  setDefaultRestTimer: (seconds: number) => void;
  setSoundEffects: (enabled: boolean) => void;
  setHapticFeedback: (enabled: boolean) => void;
  setNotifyWorkouts: (enabled: boolean) => void;
  setNotifySocial: (enabled: boolean) => void;
  setNotifyInactivity: (enabled: boolean) => void;
  fetchSettings: () => Promise<void>;
  syncToSupabase: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      heroGender: 'male',
      weightUnit: 'kg',
      heightUnit: 'cm',
      timeFormat: '24h',
      defaultRestTimer: 90,
      soundEffects: true,
      hapticFeedback: true,
      notifyWorkouts: true,
      notifySocial: true,
      notifyInactivity: true,
      isSynced: false,

      setHeroGender: (gender) => set({ heroGender: gender }),

      setWeightUnit: (unit) => {
        set({ weightUnit: unit });
        get().syncToSupabase();
      },
      setHeightUnit: (unit) => {
        set({ heightUnit: unit });
        get().syncToSupabase();
      },
      setTimeFormat: (format) => {
        set({ timeFormat: format });
        get().syncToSupabase();
      },
      setDefaultRestTimer: (seconds) => set({ defaultRestTimer: seconds }),
      setSoundEffects: (enabled) => set({ soundEffects: enabled }),
      setHapticFeedback: (enabled) => set({ hapticFeedback: enabled }),
      setNotifyWorkouts: (enabled) => set({ notifyWorkouts: enabled }),
      setNotifySocial: (enabled) => set({ notifySocial: enabled }),
      setNotifyInactivity: (enabled) => set({ notifyInactivity: enabled }),

      fetchSettings: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;

          const { data, error } = await supabase
            .from('users')
            .select('weight_unit, height_unit, time_format')
            .eq('id', session.user.id)
            .single();

          if (!error && data) {
            set({
              weightUnit: (data.weight_unit as 'kg' | 'lbs') || 'kg',
              heightUnit: (data.height_unit as 'cm' | 'in') || 'cm',
              timeFormat: (data.time_format as '12h' | '24h') || '24h',
              isSynced: true,
            });
          }
        } catch (err) {
          console.error('Failed to fetch settings:', err);
        }
      },

      syncToSupabase: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;

          const { weightUnit, heightUnit, timeFormat } = get();
          await supabase
            .from('users')
            .update({
              weight_unit: weightUnit,
              height_unit: heightUnit,
              time_format: timeFormat,
            })
            .eq('id', session.user.id);
        } catch (err) {
          console.error('Failed to sync settings:', err);
        }
      },
    }),
    { name: 'vortixia-settings' }
  )
);
