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
    const { friendId } = await req.json();

    if (!friendId) {
      return NextResponse.json({ error: 'friendId is required' }, { status: 400 });
    }

    if (friendId === session.user.id) {
      return NextResponse.json({ error: 'Cannot add yourself' }, { status: 400 });
    }

    // Check if request already exists
    const { data: existing, error: existingError } = await supabase
      .from('user_friends')
      .select('*')
      .or(`and(user_id.eq.${session.user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${session.user.id})`)
      .maybeSingle();

    if (existingError) {
      console.error("Error checking existing friend request:", existingError);
      return NextResponse.json({ error: 'Database error while checking existing request' }, { status: 500 });
    }

    if (existing) {
      // If the opposite request exists and is pending, automatically accept it
      if (existing.user_id === friendId && existing.status === 'pending') {
        const { data: updateData, error: updateError } = await supabase
          .from('user_friends')
          .update({ status: 'accepted' })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) {
          console.error("Error auto-accepting friend request:", updateError);
          return NextResponse.json({ error: 'Failed to auto-accept friend request' }, { status: 500 });
        }

        // Send push notification to the original sender (friendId) that current user accepted
        if (updateData) {
          try {
            const { data: acceptor } = await supabase
              .from('users')
              .select('username')
              .eq('id', session.user.id)
              .single();

            const { data: originalSender } = await supabase
              .from('users')
              .select('notify_social')
              .eq('id', friendId)
              .single();

            if (originalSender?.notify_social !== false) {
              const acceptorName = acceptor?.username || 'An athlete';
              await sendPushToUser(
                supabase,
                friendId,
                'Friend Request Accepted',
                `🤝 ${acceptorName} accepted your friend request! Start a duel and test your limits.`,
                '/social'
              );
            }
          } catch (pushErr) {
            console.error("Failed to send auto-accept friend request push:", pushErr);
          }
        }

        return NextResponse.json(updateData);
      }

      // If the request was previously rejected, delete it so a new request can be created
      if (existing.status === 'rejected') {
        const { error: deleteError } = await supabase
          .from('user_friends')
          .delete()
          .eq('id', existing.id);
        if (deleteError) {
          console.error("Error deleting rejected request:", deleteError);
          return NextResponse.json({ error: 'Failed to clear rejected request' }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: 'Friend request already exists or already friends' }, { status: 400 });
      }
    }

    const { data, error } = await supabase.from('user_friends').insert({
      user_id: session.user.id,
      friend_id: friendId,
      status: 'pending'
    }).select().single();

    if (error) {
      console.error("Error creating friend request:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send push notification to recipient if notify_social is enabled
    if (data) {
      try {
        const { data: sender } = await supabase
          .from('users')
          .select('username')
          .eq('id', session.user.id)
          .single();

        const { data: recipient } = await supabase
          .from('users')
          .select('notify_social')
          .eq('id', friendId)
          .single();

        if (recipient?.notify_social !== false) {
          const senderName = sender?.username || 'An athlete';
          await sendPushToUser(
            supabase,
            friendId,
            'New Friend Request',
            `🏃‍♂️ ${senderName} wants to connect with you on Vortixia Fit!`,
            '/social'
          );
        }
      } catch (pushErr) {
        console.error("Failed to send friend request push:", pushErr);
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Unexpected error in friends POST:", error);
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
    const { requestId, status } = await req.json(); // status: 'accepted' | 'rejected'

    if (!requestId || !['accepted', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    let queryResult;
    if (status === 'rejected') {
      queryResult = await supabase
        .from('user_friends')
        .delete()
        .eq('id', requestId)
        .eq('friend_id', session.user.id)
        .select()
        .single();
    } else {
      queryResult = await supabase
        .from('user_friends')
        .update({ status })
        .eq('id', requestId)
        .eq('friend_id', session.user.id)
        .select()
        .single();
    }

    const { data, error } = queryResult;
    if (error) throw error;

    // Send push notification if request is accepted
    if (data && status === 'accepted') {
      try {
        const { data: acceptor } = await supabase
          .from('users')
          .select('username')
          .eq('id', session.user.id)
          .single();

        const { data: originalSender } = await supabase
          .from('users')
          .select('notify_social')
          .eq('id', data.user_id)
          .single();

        if (originalSender?.notify_social !== false) {
          const acceptorName = acceptor?.username || 'An athlete';
          await sendPushToUser(
            supabase,
            data.user_id,
            'Friend Request Accepted',
            `🤝 ${acceptorName} accepted your friend request! Start a duel and test your limits.`,
            '/social'
          );
        }
      } catch (pushErr) {
        console.error("Failed to send friend acceptance push:", pushErr);
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const friendId = searchParams.get('friendId');

    if (!friendId) {
      return NextResponse.json({ error: 'friendId is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('user_friends')
      .delete()
      .or(`and(user_id.eq.${session.user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${session.user.id})`);

    if (error) {
      console.error("Error deleting friend request:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Unexpected error in friends DELETE:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
