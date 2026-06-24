import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

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
        return NextResponse.json(updateData);
      }

      return NextResponse.json({ error: 'Friend request already exists or already friends' }, { status: 400 });
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

    const { data, error } = await supabase
      .from('user_friends')
      .update({ status })
      .eq('id', requestId)
      .eq('friend_id', session.user.id)
      .select()
      .single();

    if (error) throw error;

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
    const requestId = searchParams.get('id');

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('user_friends')
      .delete()
      .eq('id', requestId)
      .or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`);

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
