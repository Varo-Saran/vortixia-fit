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
  
  let excludeIds: string[] = [];
  if (currentUserId) {
    excludeIds.push(currentUserId);
    
    // Fetch user's friends and pending requests
    const { data: friends } = await supabase
      .from('user_friends')
      .select('user_id, friend_id')
      .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`);
      
    if (friends) {
      friends.forEach(f => {
        if (f.user_id !== currentUserId) excludeIds.push(f.user_id);
        if (f.friend_id !== currentUserId) excludeIds.push(f.friend_id);
      });
    }
  }

  // Ensure unique IDs
  excludeIds = Array.from(new Set(excludeIds));

  if (!q) {
    let query = supabase.from('users').select('*').order('total_xp', { ascending: false }).limit(50);
    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`);
    }
      
    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } else {
    let query = supabase.from('users').select('*').ilike('username', `%${q}%`).limit(50);
    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`);
    }
      
    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }
}
