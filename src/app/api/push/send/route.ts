import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import webpush from 'web-push';

// Configure VAPID details
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BIIueWulwJKMBwrYNWiU4Rrp0Pea6HliZUOqy8uXme3sdKqXj9UVo5f6xR4ZkPB9IFLcYG7Y8GVwAu1n6XmFffU';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:support@vortixia.fit',
    vapidPublicKey,
    vapidPrivateKey
  );
}

export async function sendPushToUser(supabase: any, userId: string, title: string, message: string, url: string = '/') {
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
      console.error('Failed to send notification to endpoint:', sub.endpoint, err);
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
      return NextResponse.json({ success: true, result });
    }

    // 2. Stateless Background Scheduler Triggers
    if (type === 'workout_reminders') {
      // Find users who have not logged a workout session today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Query active users who have notify_workouts enabled
      const { data: users, error: usersErr } = await supabase
        .from('users')
        .select('id, username')
        .eq('notify_workouts', true);

      if (usersErr || !users) {
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
      }

      let reminderCount = 0;
      for (const u of users) {
        // Check if user has logged a workout session today
        const { data: sessions, error: sessionErr } = await supabase
          .from('workout_sessions')
          .select('id')
          .eq('user_id', u.id)
          .gte('end_time', todayStart.toISOString());

        if (!sessionErr && (!sessions || sessions.length === 0)) {
          await sendPushToUser(
            supabase, 
            u.id, 
            '🏋️‍♂️ Workout Reminder', 
            `Hey ${u.username || 'athlete'}! Keep your fitness goals on track and log today's routine.`,
            '/workout'
          );
          reminderCount++;
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
