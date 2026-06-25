import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

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

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Unexpected error in duels PATCH:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
