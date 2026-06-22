import { create } from 'zustand';

interface SettingsStore {
  heroGender: 'male' | 'female';
  setHeroGender: (gender: 'male' | 'female') => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  heroGender: 'male',
  setHeroGender: (gender) => set({ heroGender: gender }),
}));
