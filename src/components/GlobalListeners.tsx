"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/Toast";

export function GlobalListeners() {
  useEffect(() => {
    // 1. Auth state change listener
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          toast("You have been signed out");
        } else if (event === "TOKEN_REFRESHED") {
          console.log("Token refreshed");
        } else if (event === "SIGNED_IN") {
          // You could add a toast here if you wanted, but it might be annoying on every app open
        }
      }
    );

    // 2. Realtime listener for friend requests
    let friendRequestSubscription: ReturnType<typeof supabase.channel> | null = null;
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        friendRequestSubscription = supabase
          .channel('public:user_friends')
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

    return () => {
      authSubscription.unsubscribe();
      if (friendRequestSubscription) {
        supabase.removeChannel(friendRequestSubscription);
      }
    };
  }, []);

  return null;
}
