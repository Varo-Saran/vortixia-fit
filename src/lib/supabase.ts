import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy';

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Real Authentication is now active. Use supabase.auth.getSession() to get the active user.
