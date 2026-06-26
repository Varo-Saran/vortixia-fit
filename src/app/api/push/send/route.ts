import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import webpush from 'web-push';

// Configure VAPID details
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:support@vortixia.fit',
    vapidPublicKey,
    vapidPrivateKey
  );
}

async function sendPushToUser(supabase: any, userId: string, title: string, message: string, url: string = '/') {
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

      // Query active users in DB
      const { data: users, error: usersErr } = await supabase
        .from('users')
        .select('id, username');

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
          // Send reminder
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
      // Find users whose last workout was exactly 3 days ago (or > 3 days)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { data: users, error: usersErr } = await supabase
        .from('users')
        .select('id, username');

      if (usersErr || !users) {
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
      }

      let inactiveCount = 0;
      for (const u of users) {
        // Get user's most recent workout session
        const { data: lastSession, error: sErr } = await supabase
          .from('workout_sessions')
          .select('end_time')
          .eq('user_id', u.id)
          .order('end_time', { ascending: false })
          .limit(1);

        if (!sErr && lastSession && lastSession.length > 0) {
          const lastDate = new Date(lastSession[0].end_time);
          const diffDays = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays === 3) {
            await sendPushToUser(
              supabase,
              u.id,
              '👀 Consistency Alert',
              `It's been 3 days since your last workout, ${u.username || 'athlete'}. Don't lose your momentum!`,
              '/'
            );
            inactiveCount++;
          }
        }
      }
      return NextResponse.json({ success: true, processed: inactiveCount });
    }

    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  } catch (err: any) {
    console.error('Error sending push notifications:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
