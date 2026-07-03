import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import {
  deriveVapidPublicKeyFingerprint,
  subscriptionUsesCurrentVapidKey,
  vapidPublicKeyToUint8Array,
  VAPID_PUBLIC_KEY_FINGERPRINT_STORAGE_KEY,
} from '@/lib/push-subscription';

let pushSubscriptionAttempt: Promise<void> | null = null;

function runPushSubscriptionSingleFlight(operation: () => Promise<void>): Promise<void> {
  if (pushSubscriptionAttempt) {
    return pushSubscriptionAttempt;
  }

  const attempt = operation().finally(() => {
    if (pushSubscriptionAttempt === attempt) {
      pushSubscriptionAttempt = null;
    }
  });

  pushSubscriptionAttempt = attempt;
  return attempt;
}

function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window;
}

function readStoredVapidFingerprint(): string | null {
  try {
    return window.localStorage.getItem(VAPID_PUBLIC_KEY_FINGERPRINT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeVapidFingerprint(fingerprint: string): void {
  try {
    window.localStorage.setItem(VAPID_PUBLIC_KEY_FINGERPRINT_STORAGE_KEY, fingerprint);
  } catch {
    console.warn('Unable to persist the push key fingerprint');
  }
}

function clearStoredVapidFingerprint(): void {
  try {
    window.localStorage.removeItem(VAPID_PUBLIC_KEY_FINGERPRINT_STORAGE_KEY);
  } catch {
    console.warn('Unable to clear the push key fingerprint');
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';

  for (const byte of new Uint8Array(buffer)) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

class PushSubscriptionConflictError extends Error {
  constructor() {
    super('Push subscription ownership conflict');
    this.name = 'PushSubscriptionConflictError';
  }
}

async function registerPushSubscription(subscription: PushSubscription): Promise<void> {
  const p256dh = subscription.getKey('p256dh');
  const auth = subscription.getKey('auth');

  if (!p256dh || !auth) {
    throw new Error('Push subscription encryption keys are unavailable');
  }

  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(p256dh),
        auth: arrayBufferToBase64(auth),
      },
    }),
  });

  if (response.status === 409) {
    const responseBody: unknown = await response.json().catch(() => null);

    if (
      isRecord(responseBody)
      && responseBody.error === 'subscription_conflict'
      && responseBody.retryable === true
    ) {
      throw new PushSubscriptionConflictError();
    }
  }

  if (!response.ok) {
    throw new Error(`Failed to register push subscription. Status: ${response.status}`);
  }
}

async function createPushSubscription(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string,
): Promise<PushSubscription> {
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidPublicKeyToUint8Array(vapidPublicKey).buffer,
  });
}

async function registerWithConflictRecovery(
  registration: ServiceWorkerRegistration,
  subscription: PushSubscription,
  vapidPublicKey: string,
): Promise<PushSubscription> {
  try {
    await registerPushSubscription(subscription);
    return subscription;
  } catch (error) {
    if (!(error instanceof PushSubscriptionConflictError)) {
      throw error;
    }

    clearStoredVapidFingerprint();
    const unsubscribed = await subscription.unsubscribe();

    if (!unsubscribed) {
      throw new Error('The browser push subscription could not be replaced');
    }

    const replacement = await createPushSubscription(registration, vapidPublicKey);
    await registerPushSubscription(replacement);
    return replacement;
  }
}

async function deletePushSubscriptionFromServer(endpoint: string): Promise<void> {
  const response = await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to remove push subscription. Status: ${response.status}`);
  }
}

async function retirePushSubscription(subscription: PushSubscription): Promise<void> {
  let serverCleanupFailed = false;

  try {
    await deletePushSubscriptionFromServer(subscription.endpoint);
  } catch {
    serverCleanupFailed = true;
  }

  const unsubscribed = await subscription.unsubscribe();

  if (!unsubscribed) {
    throw new Error('The previous browser push subscription could not be removed');
  }

  if (serverCleanupFailed) {
    console.warn('Previous push subscription server cleanup is pending');
  }
}

async function ensurePushSubscription(): Promise<void> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!vapidPublicKey) {
    throw new Error('Push notifications are not configured');
  }

  const fingerprint = await deriveVapidPublicKeyFingerprint(vapidPublicKey);
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    const usesCurrentKey = await subscriptionUsesCurrentVapidKey(
      subscription,
      vapidPublicKey,
      readStoredVapidFingerprint(),
    );

    if (usesCurrentKey) {
      await registerWithConflictRecovery(registration, subscription, vapidPublicKey);
      storeVapidFingerprint(fingerprint);
      return;
    }

    await retirePushSubscription(subscription);
    subscription = null;
  }

  subscription = await createPushSubscription(registration, vapidPublicKey);

  await registerWithConflictRecovery(registration, subscription, vapidPublicKey);
  storeVapidFingerprint(fingerprint);
}

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

      subscribeToPush: () => runPushSubscriptionSingleFlight(async () => {
        if (!isPushSupported()) {
          console.warn('Push messaging is not supported in this browser');
          return;
        }

        try {
          const permission = Notification.permission === 'granted'
            ? 'granted'
            : await Notification.requestPermission();

          if (permission !== 'granted') {
            throw new Error('Notification permission was denied');
          }

          await ensurePushSubscription();
        } catch (error) {
          console.error('Failed to configure push notifications');
          throw error;
        }
      }),

      unsubscribeFromPush: async () => {
        if (!isPushSupported()) return;

        try {
          if (pushSubscriptionAttempt) {
            await pushSubscriptionAttempt.catch(() => undefined);
          }

          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();

          if (subscription) {
            await retirePushSubscription(subscription);
          }

          clearStoredVapidFingerprint();
        } catch {
          console.error('Failed to unsubscribe from push notifications');
        }
      },
    }),
    { name: 'vortixia-settings' }
  )
);
