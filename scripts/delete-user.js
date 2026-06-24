import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// We require the service role key to delete users from auth.users
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deleteUser(username) {
  console.log(`Searching for user with username: ${username}...`);
  
  // 1. Find user ID from public.users
  const { data: user, error: findError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (findError) {
    console.error(`Error finding user: ${findError.message}`);
    return;
  }

  if (!user) {
    console.log(`User ${username} not found in public.users.`);
    return;
  }

  const userId = user.id;
  console.log(`Found user ${username} with ID ${userId}. Proceeding with deletion...`);

  // 2. Delete from auth.users (Admin operation)
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  
  if (authError) {
    console.error(`Error deleting from auth.users: ${authError.message}`);
  } else {
    console.log(`Successfully deleted user ${userId} from auth.users.`);
  }

  // 3. Delete from public.users
  // (In many setups this cascades automatically from auth.users, but we delete just in case)
  const { error: publicError } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('id', userId);
    
  if (publicError) {
    console.error(`Error deleting from public.users: ${publicError.message}`);
  } else {
    console.log(`Successfully deleted user ${userId} from public.users.`);
  }
}

deleteUser('jordan_g');
