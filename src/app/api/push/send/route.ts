import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import webpush from 'web-push';

// Configure VAPID details
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

const isVapidConfigured = Boolean(vapidPublicKey && vapidPrivateKey);

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:support@vortixia.fit',
    vapidPublicKey,
    vapidPrivateKey
  );
}

export async function sendPushToUser(supabase: any, userId: string, title: string, message: string, url: string = '/') {
  if (!isVapidConfigured) {
    return { success: false, reason: 'Push service is not configured', sent: 0, failed: 0 };
  }

  // Get active subscriptions for this user
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, keys_p256dh, keys_auth')
    .eq('user_id', userId);

  if (error || !subscriptions || subscriptions.length === 0) {
    return { success: false, reason: 'No active push subscriptions' };
  }

  let successCount = 0;
  let failCount = 0;

  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.keys_p256dh,
        auth: sub.keys_auth
      }
    };

    try {
      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify({ title, message, url })
      );
      successCount++;
    } catch (err: any) {
      console.error('Push delivery failed', { statusCode: err?.statusCode });
      failCount++;
      // If subscription has expired or is invalid (gone/410/404), clean it up from database
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint);
      }
    }
  }

  return { success: true, sent: successCount, failed: failCount };
}

export async function POST(req: Request) {
  try {
    if (!isVapidConfigured) {
      return NextResponse.json({ error: 'Push service is not configured' }, { status: 503 });
    }

    const supabase = await createSupabaseServer();
    
    // Check authentication or Cron authorization header
    const authHeader = req.headers.get('authorization');
    const isCronAuth = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    
    const { data: { session } } = await supabase.auth.getSession();
    
    // If not authenticated and not authorized via CRON secret, reject
    if (!session && !isCronAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { type, userId, title, message, url } = body;

    // 1. Direct Target Test Notification
    if (userId && title && message) {
      const result = await sendPushToUser(supabase, userId, title, message, url);
      console.log(`Push dispatch result for user ${userId}:`, result);
      if (!result.sent || result.sent === 0) {
        return NextResponse.json({ 
          error: `Failed to deliver push. Reason: ${result.reason || 'No successful delivery'} (Sent: ${result.sent || 0}, Failed: ${result.failed || 0})`,
          result 
        }, { status: 500 });
      }
      return NextResponse.json({ success: true, result });
    }

    // 2. Stateless Background Scheduler Triggers
    if (type === 'workout_reminders') {
      // Fetch targeted list of users using the optimized timezone-aware database function
      const { data: users, error: rpcErr } = await supabase
        .rpc('get_users_needing_reminders');

      if (rpcErr) {
        console.error("Supabase RPC get_users_needing_reminders error:", rpcErr);
        return NextResponse.json({ error: rpcErr.message }, { status: 500 });
      }

      if (!users || users.length === 0) {
        return NextResponse.json({ success: true, processed: 0, message: "No users need reminders in this hour slot." });
      }

      let reminderCount = 0;
      for (const u of users) {
        const localHour = u.local_hour;
        let title = '🏋️‍♂️ Workout Reminder';
        let message = `Hey ${u.username || 'athlete'}! Keep your fitness goals on track and log today's routine.`;

        // 5:00 AM - 9:59 AM: Morning Motivation (Hour 7 Checkpoint)
        if (localHour >= 5 && localHour < 10) {
          title = '🌅 Rise & Grind!';
          const quotes = [
            `Hey ${u.username || 'champion'}! Start your morning with some movement to set the tone for today.`,
            `Morning ${u.username || 'athlete'}! Wake up your muscles and boost your energy for the day ahead.`,
            `A fresh morning is the perfect time to stack some wins. Log today's session!`
          ];
          message = quotes[Math.floor(Math.random() * quotes.length)];
        } 
        // 10:00 AM - 2:59 PM: Midday Planning (Hour 12 Checkpoint)
        else if (localHour >= 10 && localHour < 15) {
          title = '📅 Squeeze It In';
          const quotes = [
            `Hey ${u.username || 'athlete'}, taking a break from study/work? Squeeze in a quick session to reset.`,
            `Busy day? Block off 25 minutes between classes/meetings to keep your goals on track.`,
            `Plan your move! Even a quick lunch-hour session keeps the momentum going.`
          ];
          message = quotes[Math.floor(Math.random() * quotes.length)];
        }
        // 3:00 PM - 6:59 PM: Afternoon/Evening Urgency (Hour 16 Checkpoint)
        else if (localHour >= 15 && localHour < 19) {
          title = '⏳ Day is Slipping Away';
          const quotes = [
            `The day is winding down, ${u.username || 'athlete'}. Remember: a 15-minute workout is infinitely better than 0.`,
            `No time for a full session? Squeeze in a quick 10-minute burn. Consistency is key!`,
            `Don't let today be a zero day. Squeeze in some active minutes before the sun sets.`
          ];
          message = quotes[Math.floor(Math.random() * quotes.length)];
        }
        // 7:00 PM - 8:59 PM: Last Call (Hour 20 Checkpoint)
        else if (localHour >= 19 && localHour <= 20) {
          title = '🔔 Last Call!';
          const quotes = [
            `Last chance to train today! Crush a quick 45-minute session now, then hit the sheets on time.`,
            `Workout window is closing, ${u.username || 'athlete'}! Hit it hard now, get to sleep, and wake up fresh tomorrow.`,
            `One hour is all you need to win the day. Get in, get it done, and go to bed victorious!`
          ];
          message = quotes[Math.floor(Math.random() * quotes.length)];
        }

        try {
          await sendPushToUser(supabase, u.id, title, message, '/workout');
          reminderCount++;
        } catch (pushErr) {
          console.error(`Failed to send time-based workout push to user ${u.id}:`, pushErr);
        }
      }

      return NextResponse.json({ success: true, processed: reminderCount });
    }

    if (type === 'inactivity_alerts') {
      // Find users who haven't logged a workout in 72 hours and have notify_inactivity enabled
      const { data: users, error: usersErr } = await supabase
        .from('users')
        .select('id, username, created_at')
        .eq('notify_inactivity', true);

      if (usersErr || !users) {
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
      }

      let inactiveCount = 0;
      for (const u of users) {
        const { data: lastSession, error: sErr } = await supabase
          .from('workout_sessions')
          .select('end_time')
          .eq('user_id', u.id)
          .order('end_time', { ascending: false })
          .limit(1)
          .maybeSingle();

        let isInactive = false;
        if (!sErr) {
          if (lastSession) {
            const elapsedMs = Date.now() - new Date(lastSession.end_time).getTime();
            if (elapsedMs >= 72 * 60 * 60 * 1000) {
              isInactive = true;
            }
          } else {
            // No workout logged, check if they signed up at least 72 hours ago
            const elapsedMs = Date.now() - new Date(u.created_at).getTime();
            if (elapsedMs >= 72 * 60 * 60 * 1000) {
              isInactive = true;
            }
          }
        }

        if (isInactive) {
          await sendPushToUser(
            supabase,
            u.id,
            '👀 Consistency Nudge',
            `👀 3 days inactive! Open the app to keep your consistency streak alive.`,
            '/'
          );
          inactiveCount++;
        }
      }
      return NextResponse.json({ success: true, processed: inactiveCount });
    }

    if (type === 'cns_recovery') {
      // Find users who have notify_workouts enabled and cns_readiness is 100
      const { data: users, error: usersErr } = await supabase
        .from('users')
        .select('id, username')
        .eq('cns_readiness', 100)
        .eq('notify_workouts', true);

      if (usersErr || !users) {
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
      }

      let recoveredCount = 0;
      for (const u of users) {
        // Check if they had a workout session in the last 48 hours (meaning they trained hard and recently recovered)
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const { data: recentWorkout, error: wErr } = await supabase
          .from('workout_sessions')
          .select('id')
          .eq('user_id', u.id)
          .gte('end_time', fortyEightHoursAgo.toISOString())
          .limit(1)
          .maybeSingle();

        if (!wErr && recentWorkout) {
          await sendPushToUser(
            supabase,
            u.id,
            '💪 CNS Fully Recovered',
            `💪 Your CNS is fully recovered! You are primed for peak performance.`,
            '/recovery'
          );
          recoveredCount++;
        }
      }
      return NextResponse.json({ success: true, processed: recoveredCount });
    }

    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  } catch (err: any) {
    console.error('Error sending push notifications:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
