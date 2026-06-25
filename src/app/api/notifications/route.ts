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

    // System tips are read by default and locked to start of the day to prevent unread badge locking
    notifications.push({
      id: `system_tip_${currentDay}`,
      type: 'system_tip',
      title: selectedTip.title,
      message: selectedTip.message,
      status: 'read',
      createdAt: new Date(currentDay * 86400000).toISOString(),
      avatar_url: null
    });

    // Sort by createdAt descending
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(notifications);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
