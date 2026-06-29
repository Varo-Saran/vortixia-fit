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
  subscribeToPush: () => Promise<void>;
  unsubscribeFromPush: () => Promise<void>;
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
      setNotifyWorkouts: (enabled) => {
        set({ notifyWorkouts: enabled });
        get().syncToSupabase();
      },
      setNotifySocial: (enabled) => {
        set({ notifySocial: enabled });
        get().syncToSupabase();
      },
      setNotifyInactivity: (enabled) => {
        set({ notifyInactivity: enabled });
        get().syncToSupabase();
      },

      fetchSettings: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;

          const { data, error } = await supabase
            .from('users')
            .select('weight_unit, height_unit, time_format, notify_workouts, notify_social, notify_inactivity')
            .eq('id', session.user.id)
            .single();

          if (!error && data) {
            set({
              weightUnit: (data.weight_unit as 'kg' | 'lbs') || 'kg',
              heightUnit: (data.height_unit as 'cm' | 'in') || 'cm',
              timeFormat: (data.time_format as '12h' | '24h') || '24h',
              notifyWorkouts: data.notify_workouts !== false,
              notifySocial: data.notify_social !== false,
              notifyInactivity: data.notify_inactivity !== false,
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

          const { weightUnit, heightUnit, timeFormat, notifyWorkouts, notifySocial, notifyInactivity } = get();
          await supabase
            .from('users')
            .update({
              weight_unit: weightUnit,
              height_unit: heightUnit,
              time_format: timeFormat,
              notify_workouts: notifyWorkouts,
              notify_social: notifySocial,
              notify_inactivity: notifyInactivity,
            })
            .eq('id', session.user.id);
        } catch (err) {
          console.error('Failed to sync settings:', err);
        }
      },

      subscribeToPush: async () => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
          console.warn('Push messaging is not supported in this browser');
          return;
        }

        try {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            throw new Error('Notification permission was denied');
          }

          const registration = await navigator.serviceWorker.ready;

          const existingSubscription = await registration.pushManager.getSubscription();

          if (existingSubscription) {
            const p256dh = existingSubscription.getKey('p256dh');
            const auth = existingSubscription.getKey('auth');

            if (p256dh && auth) {
              const p256dhStr = btoa(String.fromCharCode(...Array.from(new Uint8Array(p256dh))));
              const authStr = btoa(String.fromCharCode(...Array.from(new Uint8Array(auth))));
              
              await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  endpoint: existingSubscription.endpoint,
                  keys: {
                    p256dh: p256dhStr,
                    auth: authStr,
                  }
                })
              });
            }
            return;
          }

          const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!vapidKey) {
            console.error('VAPID public key is not set');
            return;
          }

          const convertedVapidKey = urlBase64ToUint8Array(vapidKey);

          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
          });


          const p256dh = subscription.getKey('p256dh');
          const auth = subscription.getKey('auth');

          if (p256dh && auth) {
            const p256dhStr = btoa(String.fromCharCode(...Array.from(new Uint8Array(p256dh))));
            const authStr = btoa(String.fromCharCode(...Array.from(new Uint8Array(auth))));

            const res = await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: p256dhStr,
                  auth: authStr,
                }
              })
            });


            if (!res.ok) {
              throw new Error(`Failed to register subscription on backend. Status: ${res.status}`);
            }
          }
        } catch (err) {
          console.error('Error during push subscription trace:', err);
          throw err;
        }
      },

      unsubscribeFromPush: async () => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();

          if (subscription) {
            await fetch('/api/push/subscribe', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint: subscription.endpoint })
            });

            await subscription.unsubscribe();
          }
        } catch (err) {
          console.error('Error unsubscribing from push:', err);
        }
      },
    }),
    { name: 'vortixia-settings' }
  )
);

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
