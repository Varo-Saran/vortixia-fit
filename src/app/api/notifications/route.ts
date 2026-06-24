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
        users!user_friends_user_id_fkey(username)
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
        user_id_1, 
        users!duels_user_id_1_fkey(username), 
        wager_xp, 
        duration_days
      `)
      .eq('user_id_2', userId)
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
        
        notifications.push({
          id: req.id,
          type: 'friend_request',
          title: 'New Friend Request',
          message: `${username} wants to connect with you.`,
          status: 'unread',
          createdAt: req.created_at || new Date().toISOString()
        });
      });
    }

    if (duelChallenges) {
      duelChallenges.forEach((duel: any) => {
        const userObj = Array.isArray(duel.users) ? duel.users[0] : duel.users;
        const username = userObj?.username || 'Someone';

        notifications.push({
          id: duel.id,
          type: 'duel_challenge',
          title: 'Duel Challenge!',
          message: `${username} challenged you to a ${duel.duration_days}-day duel for ${duel.wager_xp} XP!`,
          status: 'unread',
          createdAt: duel.created_at || new Date().toISOString()
        });
      });
    }

    // Sort by createdAt descending
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(notifications);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
