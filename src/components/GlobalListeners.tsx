"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useNotificationStore } from "@/store/useNotificationStore";

export function GlobalListeners() {
  const router = useRouter();

  useEffect(() => {
    // Pre-emptive push check for standalone PWA layout mode
    const checkAndPromptPush = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      
      if (
        isStandalone &&
        typeof window !== 'undefined' &&
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
      (event, session) => {
        if (event === "SIGNED_OUT") {
          toast("You have been signed out");
          caches.keys().then((names) => {
            for (let name of names) caches.delete(name);
          });
          router.push('/login');
        } else if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
          initNotifications();
        }
      }
    );

    // Initial check
    initNotifications();

    // 2. Realtime listener for friend requests (to show interactive Toast notifications)
    let friendRequestSubscription: ReturnType<typeof supabase.channel> | null = null;
    
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
            (payload: any) => {
              if (payload.new.status === 'pending') {
                toast("You have a new friend request!", { icon: "👋" });
              }
            }
          )
          .subscribe();
      }
    });

    // 3. Foreground Sync Anchor for Offline Workouts
    const syncWorkouts = async () => {
      if (navigator.onLine) {
        const unsynced = localStorage.getItem('unsynced_workouts');
        if (unsynced) {
          try {
            const workouts = JSON.parse(unsynced);
            if (workouts.length > 0) {
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user?.id) {
                const userId = session.user.id;
                
                while (true) {
                  const currentUnsynced = localStorage.getItem('unsynced_workouts');
                  if (!currentUnsynced) break;
                  const currentWorkouts = JSON.parse(currentUnsynced);
                  if (currentWorkouts.length === 0) break;

                  const workout = currentWorkouts[0];

                  const { data: sessionRow, error: sessionErr } = await supabase
                    .from('workout_sessions')
                    .insert({
                      user_id: userId,
                      start_time: workout.startTime,
                      end_time: workout.endTime,
                      total_volume_kg: workout.totalVolume,
                      prs_broken: 0,
                    })
                    .select('id')
                    .single();

                  if (sessionErr || !sessionRow) {
                    console.error('Failed to sync workout session', sessionErr);
                    break;
                  }

                  if (workout.completedSets.length > 0) {
                    const setsToInsert = workout.completedSets.map((s: any) => ({
                      session_id: sessionRow.id,
                      exercise_name: s.exerciseName,
                      set_number: s.setNumber,
                      weight: s.weight,
                      reps: s.reps,
                      weight_unit: 'kg',
                      tracking_type: 'reps_weight',
                    }));
                    const { error: setsErr } = await supabase.from('workout_sets').insert(setsToInsert);
                    if (setsErr) {
                      console.error('Failed to insert sets for synced session', setsErr);
                    }
                  }

                  // Update user XP atomically via RPC
                  const { error: xpErr } = await supabase.rpc('increment_user_xp', { user_id: userId, xp_to_add: workout.xpEarned });
                  if (xpErr) {
                    console.error('Failed to update XP for synced session', xpErr);
                  }

                  // Update active duels in Supabase
                  try {
                    const { data: duels } = await supabase
                      .from('duels')
                      .select('id, challenger_id, opponent_id, user_1_score, user_2_score')
                      .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
                      .eq('status', 'active');

                    if (duels && duels.length > 0) {
                      for (const duel of duels) {
                        const isChallenger = duel.challenger_id === userId;
                        if (isChallenger) {
                          await supabase
                            .from('duels')
                            .update({ user_1_score: (duel.user_1_score || 0) + workout.xpEarned })
                            .eq('id', duel.id);
                        } else {
                          await supabase
                            .from('duels')
                            .update({ user_2_score: (duel.user_2_score || 0) + workout.xpEarned })
                            .eq('id', duel.id);
                        }
                      }
                    }
                  } catch (duelErr) {
                    console.error('Failed to update active duels on sync:', duelErr);
                  }

                  // Trigger workout completion push notification to friends
                  try {
                    await fetch('/api/push/workout-complete', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        routineName: workout.routineName || 'Workout',
                        xpEarned: workout.xpEarned
                      })
                    });
                  } catch (pushErr) {
                    console.error('Failed to trigger workout completion push on sync:', pushErr);
                  }

                  const remainingWorkouts = currentWorkouts.slice(1);
                  if (remainingWorkouts.length > 0) {
                    localStorage.setItem('unsynced_workouts', JSON.stringify(remainingWorkouts));
                  } else {
                    localStorage.removeItem('unsynced_workouts');
                  }
                }

                const checkRemaining = localStorage.getItem('unsynced_workouts');
                if (!checkRemaining || JSON.parse(checkRemaining).length === 0) {
                  toast("Offline workouts synced successfully!");
                }
              }
            }
          } catch (e) {
            console.error('Error syncing offline workouts', e);
          }
        }
      }
    };

    // 4. Foreground Sync Anchor for Offline Feedback
    const syncFeedback = async () => {
      if (navigator.onLine) {
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
    };
  }, [router]);

  return null;
}
