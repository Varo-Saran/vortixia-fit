import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { sendPushToUser } from '@/app/api/push/send/route';

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { routineName, xpEarned } = body;

    if (xpEarned === undefined) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Get current user's username
    const { data: currentUser } = await supabase
      .from('users')
      .select('username')
      .eq('id', userId)
      .single();

    const username = currentUser?.username || 'An athlete';

    // 1. Get all accepted friends of the user
    const { data: friendships, error: friendErr } = await supabase
      .from('user_friends')
      .select('user_id, friend_id')
      .eq('status', 'accepted')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (friendErr || !friendships || friendships.length === 0) {
      return NextResponse.json({ success: true, message: 'No friends to notify' });
    }

    const friendIds = friendships.map(f => f.user_id === userId ? f.friend_id : f.user_id);

    // 2. Query friends who have notify_social enabled
    const { data: profiles, error: profileErr } = await supabase
      .from('users')
      .select('id')
      .in('id', friendIds)
      .eq('notify_social', true);

    if (profileErr || !profiles || profiles.length === 0) {
      return NextResponse.json({ success: true, message: 'No friends with social notifications enabled' });
    }

    const activeFriendIds = profiles.map(p => p.id);

    // 3. Dispatch push notifications to each active friend
    const title = '⚡ Friend Workout Alert!';
    const message = `⚡ ${username} just logged a ${routineName || 'workout'} (+${xpEarned} XP)! Your turn.`;
    const url = '/social';

    let successCount = 0;
    for (const friendId of activeFriendIds) {
      try {
        const result = await sendPushToUser(supabase, friendId, title, message, url);
        if (result.success && typeof result.sent === 'number') {
          successCount += result.sent;
        }
      } catch (e) {
        console.error(`Failed to send workout completion push to friend ${friendId}:`, e);
      }
    }

    return NextResponse.json({ success: true, notificationsSent: successCount });
  } catch (err: any) {
    console.error('Error in workout complete push trigger:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
