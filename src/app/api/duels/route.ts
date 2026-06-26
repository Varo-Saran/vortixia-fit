import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { sendPushToUser } from '@/app/api/push/send/route';

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { opponentId, wagerXp, durationDays } = await req.json();

    if (!opponentId || wagerXp === undefined || !durationDays) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const { data: duel, error } = await supabase
      .from('duels')
      .insert({
        challenger_id: session.user.id,
        opponent_id: opponentId,
        wager_xp: wagerXp,
        duration_days: durationDays,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating duel in API:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send push notification to opponent
    if (duel) {
      try {
        const { data: challenger } = await supabase
          .from('users')
          .select('username')
          .eq('id', session.user.id)
          .single();

        const { data: opponent } = await supabase
          .from('users')
          .select('notify_social')
          .eq('id', opponentId)
          .single();

        if (opponent?.notify_social !== false) {
          const challengerName = challenger?.username || 'An athlete';
          await sendPushToUser(
            supabase,
            opponentId,
            '⚔️ Duel Challenge!',
            `${challengerName} challenged you to a ${durationDays}-day duel for ${wagerXp} XP!`,
            '/social'
          );
        }
      } catch (pushErr) {
        console.error("Failed to send duel challenge push:", pushErr);
      }
    }

    return NextResponse.json(duel);
  } catch (error: any) {
    console.error("Unexpected error in duels POST:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { duelId, status } = await req.json(); // status: 'active' | 'declined'

    if (!duelId || !['active', 'declined'].includes(status)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    let queryResult;
    if (status === 'declined') {
      // Delete declined challenges to clean up database and prevent clutter
      queryResult = await supabase
        .from('duels')
        .delete()
        .eq('id', duelId)
        .eq('opponent_id', session.user.id)
        .select()
        .single();
    } else {
      queryResult = await supabase
        .from('duels')
        .update({ status: 'active' }) // set to active
        .eq('id', duelId)
        .eq('opponent_id', session.user.id)
        .select()
        .single();
    }

    const { data, error } = queryResult;
    if (error) {
      console.error("Error updating duel status:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send push notification when opponent accepts the duel
    if (data && status === 'active') {
      try {
        const { data: opponent } = await supabase
          .from('users')
          .select('username')
          .eq('id', session.user.id)
          .single();

        const { data: challenger } = await supabase
          .from('users')
          .select('notify_social')
          .eq('id', data.challenger_id)
          .single();

        if (challenger?.notify_social !== false) {
          const opponentName = opponent?.username || 'An athlete';
          await sendPushToUser(
            supabase,
            data.challenger_id,
            '🔥 The battle begins!',
            `Your duel against ${opponentName} is now active.`,
            '/social'
          );
        }
      } catch (pushErr) {
        console.error("Failed to send duel acceptance push:", pushErr);
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Unexpected error in duels PATCH:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
