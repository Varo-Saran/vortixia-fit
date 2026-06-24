import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json({ error: 'Username query parameter "q" is required' }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();

    // Check if the username exists
    const { data: existingUser, error } = await supabase
      .from('users')
      .select('username')
      .ilike('username', q)
      .maybeSingle();

    if (error) {
      console.error("Error checking username:", error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!existingUser) {
      // Username is available
      return NextResponse.json({ available: true });
    }

    // Username exists, generate suggestions
    const suggestions: string[] = [];
    const suffixes = ['_1', '99', '_fit', '123', 'X', '_pro'];
    
    // Simple way to generate unique-ish suggestions, we can check a batch of them or just generate random ones
    for (const suffix of suffixes) {
      if (suggestions.length >= 3) break;
      suggestions.push(`${q}${suffix}`);
    }

    // Optionally, we could verify that the suggestions are actually available,
    // but for simplicity and speed, appending random suffixes is usually enough.

    return NextResponse.json({ 
      available: false, 
      suggestions 
    });

  } catch (error: any) {
    console.error("Exception in username-check route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
