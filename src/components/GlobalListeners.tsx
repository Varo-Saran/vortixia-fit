"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { syncQueuedWorkoutCompletions } from "@/lib/workout-completion-client";

export function GlobalListeners() {
  const router = useRouter();

  useEffect(() => {
    // Pre-emptive push check for standalone PWA layout mode
    const checkAndPromptPush = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (typeof window === 'undefined') return;

      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const { subscribeToPush } = useSettingsStore.getState();
          await subscribeToPush();
        } catch (err) {
          console.error('Failed to synchronize push notifications:', err);
        }
        return;
      }

      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOS = /ipad|iphone|ipod/.test(userAgent)
        && !(window as Window & { MSStream?: unknown }).MSStream;

      // iOS strictly blocks programmatic requestPermission calls without a user gesture.
      // Calling it on-mount permanently marks the permission as 'denied' on iOS.
      if (isIOS) {
        console.log("Skipping programmatic mount prompt on iOS to prevent WebKit gesture block");
        return;
      }

      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      
      if (
        isStandalone &&
        'Notification' in window &&
        Notification.permission === 'default'
      ) {
        console.log("Pre-emptive PWA push notification permission prompt triggered...");
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const { subscribeToPush } = useSettingsStore.getState();
            await subscribeToPush();
            toast("Notifications enabled successfully!", { icon: "🔔" });
          }
        } catch (err) {
          console.error("Failed to request push permissions on-mount:", err);
        }
      }
    };

    // Helper to load notifications & init realtime
    const initNotifications = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const store = useNotificationStore.getState();
        await store.fetchNotifications();
        store.initRealtime();
        
        // Trigger pre-emptive prompt check
        checkAndPromptPush();
      }
    };

    // 1. Auth state change listener
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_OUT") {
          toast("You have been signed out");
          caches.keys().then((names) => {
            for (const name of names) caches.delete(name);
          });
          router.push('/login');
        } else if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
          initNotifications();
        }
      }
    );

    // Initial check
    initNotifications();

    // 2. Realtime listener for friend requests & duel challenges (to show interactive Toast notifications)
    let friendRequestSubscription: ReturnType<typeof supabase.channel> | null = null;
    let duelChallengeSubscription: ReturnType<typeof supabase.channel> | null = null;
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        friendRequestSubscription = supabase
          .channel('public:user_friends_toast')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'user_friends',
              filter: `friend_id=eq.${session.user.id}`,
            },
            (payload) => {
              if (payload.new.status === 'pending') {
                toast("You have a new friend request!", { icon: "👋" });
              }
            }
          )
          .subscribe();

        duelChallengeSubscription = supabase
          .channel('public:duels_toast')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'duels',
              filter: `opponent_id=eq.${session.user.id}`,
            },
            (payload) => {
              if (payload.new.status === 'pending') {
                toast("You have been challenged to a duel! ⚔️", { icon: "⚔️" });
              }
            }
          )
          .subscribe();
      }
    });

    // 3. Foreground Sync Anchor for Offline Workouts
    const syncWorkouts = async () => {
      try {
        const result = await syncQueuedWorkoutCompletions({
          onCommitted: (request, completionResult) => {
            useWorkoutStore.getState().applyCompletionResult(
              request,
              completionResult,
            );
          },
          onLegacyConverted: (operationId) => {
            // The legacy workout page applied these presentation effects before
            // queueing, so conversion records them as already handled.
            useWorkoutStore.getState().markLocalEffectsHandled(operationId);
          },
        });

        if (result.quarantined > 0) {
          toast("Some saved workouts need review before they can sync.", {
            icon: "⚠️",
          });
        }
        if (result.synced > 0 && result.remaining === 0) {
          toast("Offline workouts synced successfully!");
        }
      } catch {
        console.error('Offline workout sync failed');
      }
    };

    // 4. Foreground Sync Anchor for Offline Feedback
    const syncFeedback = async () => {
      const unsynced = localStorage.getItem('unsynced_feedback');
      if (unsynced) {
        try {
          const feedbacks = JSON.parse(unsynced);
          if (Array.isArray(feedbacks) && feedbacks.length > 0) {
            while (true) {
              const currentUnsynced = localStorage.getItem('unsynced_feedback');
              if (!currentUnsynced) break;
              const currentFeedbacks = JSON.parse(currentUnsynced);
              if (!Array.isArray(currentFeedbacks) || currentFeedbacks.length === 0) break;

              const feedbackItem = currentFeedbacks[0];

              try {
                const res = await fetch('/api/feedback', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(feedbackItem),
                });
                if (!res.ok) {
                  console.error('Failed to sync feedback item:', res.statusText);
                  if (res.status >= 400 && res.status < 500) {
                    console.warn('Discarding invalid offline feedback item (client error):', res.status);
                  } else {
                    break;
                  }
                }
              } catch (err) {
                console.error('Network error during feedback sync:', err);
                break;
              }

              const remainingFeedbacks = currentFeedbacks.slice(1);
              if (remainingFeedbacks.length > 0) {
                localStorage.setItem('unsynced_feedback', JSON.stringify(remainingFeedbacks));
              } else {
                localStorage.removeItem('unsynced_feedback');
              }
            }

            const checkRemaining = localStorage.getItem('unsynced_feedback');
            if (!checkRemaining || JSON.parse(checkRemaining).length === 0) {
              toast("Offline feedback synced successfully!");
            }
          }
        } catch (e) {
          console.error('Error syncing offline feedback', e);
        }
      }
    };

    window.addEventListener('online', syncWorkouts);
    window.addEventListener('online', syncFeedback);
    syncWorkouts();
    syncFeedback();

    return () => {
      authSubscription.unsubscribe();
      window.removeEventListener('online', syncWorkouts);
      window.removeEventListener('online', syncFeedback);
      if (friendRequestSubscription) {
        supabase.removeChannel(friendRequestSubscription);
      }
      if (duelChallengeSubscription) {
        supabase.removeChannel(duelChallengeSubscription);
      }
    };
  }, [router]);

  return null;
}
