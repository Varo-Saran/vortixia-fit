import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const now = Date.now();
  
  let rateLimitInfo = rateLimitMap.get(ip);
  if (!rateLimitInfo || rateLimitInfo.resetTime < now) {
    rateLimitInfo = { count: 0, resetTime: now + 60 * 1000 };
  }
  
  rateLimitInfo.count += 1;
  rateLimitMap.set(ip, rateLimitInfo);
  
  if (rateLimitInfo.count > 60) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  
  const supabase = await createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  const currentUserId = session?.user?.id;
  
  if (!q) {
    let query = supabase.from('users').select('*').order('total_xp', { ascending: false }).limit(50);
    if (currentUserId) query = query.neq('id', currentUserId);
      
    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } else {
    let query = supabase.from('users').select('*').ilike('username', `%${q}%`).limit(50);
    if (currentUserId) query = query.neq('id', currentUserId);
      
    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }
}
