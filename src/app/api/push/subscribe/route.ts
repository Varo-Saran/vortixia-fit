import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function registrationFailureResponse() {
  return NextResponse.json(
    { error: 'subscription_registration_failed' },
    { status: 500 },
  );
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: unknown = await req.json().catch(() => null);

    if (!isRecord(body) || !isNonEmptyString(body.endpoint) || !isRecord(body.keys)) {
      return NextResponse.json({ error: 'Missing subscription parameters' }, { status: 400 });
    }

    const { p256dh, auth } = body.keys;

    if (!isNonEmptyString(p256dh) || !isNonEmptyString(auth)) {
      return NextResponse.json({ error: 'Missing subscription parameters' }, { status: 400 });
    }

    const { data: ownedRows, error: updateError } = await supabase
      .from('push_subscriptions')
      .update({
        keys_p256dh: p256dh,
        keys_auth: auth,
      })
      .eq('user_id', user.id)
      .eq('endpoint', body.endpoint)
      .select('id');

    if (updateError) {
      console.error('Push subscription refresh failed');
      return registrationFailureResponse();
    }

    if (ownedRows && ownedRows.length > 0) {
      return NextResponse.json({ success: true });
    }

    const { error: insertError } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: user.id,
        endpoint: body.endpoint,
        keys_p256dh: p256dh,
        keys_auth: auth,
      });

    if (insertError?.code === '23505') {
      return NextResponse.json(
        { error: 'subscription_conflict', retryable: true },
        { status: 409 },
      );
    }

    if (insertError) {
      console.error('Push subscription registration failed');
      return registrationFailureResponse();
    }

    return NextResponse.json({ success: true });
  } catch {
    console.error('Push subscription registration failed');
    return registrationFailureResponse();
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: unknown = await req.json().catch(() => null);

    if (!isRecord(body) || !isNonEmptyString(body.endpoint)) {
      return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', body.endpoint);

    if (error) {
      console.error('Push subscription removal failed');
      return NextResponse.json({ error: 'subscription_removal_failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    console.error('Push subscription removal failed');
    return NextResponse.json({ error: 'subscription_removal_failed' }, { status: 500 });
  }
}
