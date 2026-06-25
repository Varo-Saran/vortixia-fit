"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/store/useNotificationStore";

export function GlobalListeners() {
  const router = useRouter();

  useEffect(() => {
    // Helper to load notifications & init realtime
    const initNotifications = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const store = useNotificationStore.getState();
        await store.fetchNotifications();
        store.initRealtime();
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
                for (const workout of workouts) {
                  const { data: sessionRow } = await supabase
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

                  if (sessionRow && workout.completedSets.length > 0) {
                    const setsToInsert = workout.completedSets.map((s: any) => ({
                      session_id: sessionRow.id,
                      exercise_name: s.exerciseName,
                      set_number: s.setNumber,
                      weight: s.weight,
                      reps: s.reps,
                      weight_unit: 'kg',
                      tracking_type: 'reps_weight',
                    }));
                    await supabase.from('workout_sets').insert(setsToInsert);
                  }

                  // Update user XP atomically via RPC
                  await supabase.rpc('increment_user_xp', { user_id: userId, xp_to_add: workout.xpEarned });
                }
                localStorage.removeItem('unsynced_workouts');
                toast("Offline workouts synced successfully!");
              }
            }
          } catch (e) {
            console.error('Error syncing offline workouts', e);
          }
        }
      }
    };

    window.addEventListener('online', syncWorkouts);
    syncWorkouts();

    return () => {
      authSubscription.unsubscribe();
      window.removeEventListener('online', syncWorkouts);
      if (friendRequestSubscription) {
        supabase.removeChannel(friendRequestSubscription);
      }
    };
  }, [router]);

  return null;
}
