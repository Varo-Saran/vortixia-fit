import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';

interface SettingsStore {
  heroGender: 'male' | 'female';
  weightUnit: 'kg' | 'lbs';
  heightUnit: 'cm' | 'in';
  timeFormat: '12h' | '24h';
  isSynced: boolean;

  setHeroGender: (gender: 'male' | 'female') => void;
  setWeightUnit: (unit: 'kg' | 'lbs') => void;
  setHeightUnit: (unit: 'cm' | 'in') => void;
  setTimeFormat: (format: '12h' | '24h') => void;
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
