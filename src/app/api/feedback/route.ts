import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: Request) {
  let userId: string | null = null;
  let userEmail: string | null = null;
  let username: string | null = null;
  
  try {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      userId = session.user.id;
      userEmail = session.user.email || null;
      // Get username from users profile
      const { data: userProfile } = await supabase
        .from('users')
        .select('username')
        .eq('id', userId)
        .single();
      username = userProfile?.username || session.user.user_metadata?.preferred_username || 'authenticated_user';
    }
  } catch (e) {
    console.warn("Could not retrieve user session, continuing anonymously:", e);
  }

  try {
    const body = await req.json();
    const type = body.type;
    let data = body.data;

    // Backward compatibility: Reconstruct data object from flat body properties if missing
    if (!data && type) {
      if (type === 'bug') {
        data = {
          title: body.title,
          steps: body.description,
          severity: body.severity
        };
      } else if (type === 'suggestion') {
        data = {
          title: body.title,
          details: body.description
        };
      } else if (type === 'exercise') {
        data = {
          title: body.title,
          targetMuscle: body.target_muscle || body.targetMuscle,
          equipment: body.equipment
        };
      } else if (type === 'general') {
        data = {
          message: body.description
        };
      }
    }

    if (!type || !data) {
      return NextResponse.json({ error: 'Type and data are required' }, { status: 400 });
    }

    const deviceMetadata = body.deviceMetadata || body.device_metadata || {};

    const supabase = await createSupabaseServer();
    const { error: dbError } = await supabase
      .from('feedback')
      .insert({
        user_id: userId,
        user_email: userEmail,
        username: username,
        type,
        data,
        device_metadata: deviceMetadata,
        status: 'pending',
      });

    if (dbError) {
      console.error('Error inserting feedback to database:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Unexpected error in feedback POST:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify is_admin check in database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (userError || !user || !user.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: feedbackData, error: feedbackError } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (feedbackError) {
      return NextResponse.json({ error: feedbackError.message }, { status: 500 });
    }

    // Flatten data object structure to support UI viewer expectations if needed
    const mappedData = (feedbackData || []).map(item => {
      const flattened = {
        ...item,
        title: item.data?.title || item.data?.summary || item.data?.name || item.data?.message || 'Feedback Report',
        description: item.data?.details || item.data?.steps || item.data?.message || null,
        severity: item.data?.severity || null,
        target_muscle: item.data?.targetMuscle || null,
        equipment: item.data?.equipment || null,
        source: 'supabase'
      };
      return flattened;
    });

    return NextResponse.json({ success: true, data: mappedData });
  } catch (error: any) {
    console.error("GET feedback error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify is_admin check in database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (userError || !user || !user.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { ids, status } = await req.json();
    if (!ids || !Array.isArray(ids) || !status) {
      return NextResponse.json({ error: 'Invalid body parameters (ids, status are required)' }, { status: 400 });
    }

    if (!['reviewed', 'archived', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { error: patchError } = await supabase
      .from('feedback')
      .update({ status })
      .in('id', ids);

    if (patchError) {
      console.error('Supabase PATCH error:', patchError);
      return NextResponse.json({ error: patchError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Unexpected error in feedback PATCH:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
