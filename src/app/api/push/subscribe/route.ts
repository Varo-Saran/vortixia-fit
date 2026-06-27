import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    console.log("POST /api/push/subscribe triggered. Session present:", !!session);
    if (session) {
      console.log("Authenticated User ID:", session?.user?.id);
    }

    if (!session) {
      console.warn("Unauthorized access attempt to POST /api/push/subscribe");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    console.log("Request body endpoint:", body?.endpoint);
    console.log("Request body keys present - p256dh:", !!body?.keys?.p256dh, "auth:", !!body?.keys?.auth);

    const { endpoint, keys } = body;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      console.warn("Invalid parameters in push subscription payload:", body);
      return NextResponse.json({ error: 'Missing subscription parameters' }, { status: 400 });
    }

    // Upsert subscription (endpoint is unique)
    console.log("Upserting subscription to push_subscriptions table for user:", userId);
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint,
        keys_p256dh: keys.p256dh,
        keys_auth: keys.auth,
      }, { onConflict: 'endpoint' })
      .select();

    if (error) {
      console.error('Failed to upsert push subscription in Supabase:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("Upserted push subscription successfully:", data);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('Error in push subscription registration:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { session } } = await supabase.auth.getSession();

    console.log("DELETE /api/push/subscribe triggered. Session present:", !!session);
    if (session) {
      console.log("Authenticated User ID:", session?.user?.id);
    }

    if (!session) {
      console.warn("Unauthorized access attempt to DELETE /api/push/subscribe");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
    }

    // Delete the subscription linked to this user
    console.log("Deleting subscription for endpoint:", endpoint);
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint);

    if (error) {
      console.error('Failed to delete push subscription:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("Subscription deleted successfully.");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting push subscription:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
