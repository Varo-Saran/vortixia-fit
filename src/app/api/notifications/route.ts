import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userId = session.user.id;

    // Fetch pending friend requests
    const { data: friendRequests, error: frError } = await supabase
      .from('user_friends')
      .select(`
        id, 
        created_at, 
        user_id, 
        users!user_friends_user_id_fkey(username, avatar_url)
      `)
      .eq('friend_id', userId)
      .eq('status', 'pending');

    if (frError) {
      console.error("Friend request fetch error:", frError);
    }

    // Fetch pending duel challenges
    const { data: duelChallenges, error: duelError } = await supabase
      .from('duels')
      .select(`
        id, 
        created_at, 
        challenger_id, 
        users!duels_challenger_id_fkey(username, avatar_url), 
        wager_xp, 
        duration_days
      `)
      .eq('opponent_id', userId)
      .eq('status', 'pending');

    if (duelError) {
      console.error("Duel fetch error:", duelError);
    }

    const notifications: any[] = [];

    if (friendRequests) {
      friendRequests.forEach((req: any) => {
        // Handle case where users is an array or object depending on foreign key
        const userObj = Array.isArray(req.users) ? req.users[0] : req.users;
        const username = userObj?.username || 'Someone';
        const avatarUrl = userObj?.avatar_url || null;
        
        notifications.push({
          id: req.id,
          type: 'friend_request',
          title: 'New Friend Request',
          message: `${username} wants to connect with you.`,
          status: 'unread',
          createdAt: req.created_at || new Date().toISOString(),
          avatar_url: avatarUrl
        });
      });
    }

    if (duelChallenges) {
      duelChallenges.forEach((duel: any) => {
        const userObj = Array.isArray(duel.users) ? duel.users[0] : duel.users;
        const username = userObj?.username || 'Someone';
        const avatarUrl = userObj?.avatar_url || null;

        notifications.push({
          id: duel.id,
          type: 'duel_challenge',
          title: 'Duel Challenge!',
          message: `${username} challenged you to a ${duel.duration_days}-day duel for ${duel.wager_xp} XP!`,
          status: 'unread',
          createdAt: duel.created_at || new Date().toISOString(),
          avatar_url: avatarUrl
        });
      });
    }

    const SYSTEM_TIPS = [
      { title: "Did you know?", message: "You can challenge your friends to Duels for XP!" },
      { title: "Pro Tip", message: "Keep a daily streak to maximize your level gains." },
      { title: "Social", message: "Check out Recommended Athletes to find new friends." },
      { title: "Personalize", message: "You can change your username in the settings page." }
    ];

    // Deterministic selection based on user ID and current day
    const currentDay = Math.floor(Date.now() / 86400000);
    const idHash = userId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
    const tipIndex = (currentDay + idHash) % SYSTEM_TIPS.length;
    const selectedTip = SYSTEM_TIPS[tipIndex];

    // System tips are unread by default so they trigger the dashboard badge until read/dismissed
    notifications.push({
      id: `system_tip_${currentDay}`,
      type: 'system_tip',
      title: selectedTip.title,
      message: selectedTip.message,
      status: 'unread',
      createdAt: new Date(currentDay * 86400000).toISOString(),
      avatar_url: null
    });

    // Dynamic, timezone-aware workout reminder notification
    const { data: userProfile } = await supabase
      .from('users')
      .select('username, timezone')
      .eq('id', userId)
      .single();

    const timezone = userProfile?.timezone || 'UTC';
    const username = userProfile?.username || 'athlete';

    const { data: lastSession } = await supabase
      .from('workout_sessions')
      .select('end_time')
      .eq('user_id', userId)
      .order('end_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    let hasWorkoutToday = false;
    if (lastSession) {
      try {
        const options: Intl.DateTimeFormatOptions = { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' };
        const dtf = new Intl.DateTimeFormat('en-US', options);
        const lastSessionDate = dtf.format(new Date(lastSession.end_time));
        const currentDate = dtf.format(new Date());
        if (lastSessionDate === currentDate) {
          hasWorkoutToday = true;
        }
      } catch (e) {
        console.error("Timezone comparison error:", e);
      }
    }

    if (!hasWorkoutToday) {
      let localHour = new Date().getUTCHours();
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          hour12: false
        });
        localHour = parseInt(formatter.format(new Date()), 10);
      } catch (e) {
        console.error("Error formatting local time:", e);
      }

      if (localHour >= 5 && localHour < 24) {
        let title = '🏋️‍♂️ Workout Reminder';
        let message = `Hey ${username}! Keep your fitness goals on track and log today's routine.`;

        if (localHour >= 5 && localHour < 10) {
          title = '🌅 Rise & Grind!';
          message = `Hey ${username}! Start your morning with some movement to set the tone for today.`;
        } else if (localHour >= 10 && localHour < 15) {
          title = '📅 Squeeze It In';
          message = `Hey ${username}, taking a break from study/work? Squeeze in a quick session to reset.`;
        } else if (localHour >= 15 && localHour < 19) {
          title = '⏳ Day is Slipping Away';
          message = `The day is winding down, ${username}. Remember: a 15-minute workout is infinitely better than 0.`;
        } else if (localHour >= 19 && localHour <= 23) {
          title = '🔔 Last Call!';
          message = `Last chance to train today! Crush a quick 45-minute session now, then hit the sheets on time.`;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        notifications.push({
          id: `workout_reminder_${todayStr}`,
          type: 'system_alert',
          title,
          message,
          status: 'unread',
          createdAt: new Date().toISOString(),
          avatar_url: null
        });
      }
    }

    // Sort by createdAt descending
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(notifications);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
