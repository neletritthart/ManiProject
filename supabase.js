// Supabase client
// The anon/publishable key is intentionally public — it is safe to commit.
// NEVER put the service_role key here.

const SUPABASE_URL     = 'https://rtzrasfcuwmqzxrsnvwn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xj1pYSRJLWlSvNBxvRCQuA_c7FNg4TW';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
