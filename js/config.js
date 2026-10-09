// Public Supabase project credentials only. Never place a service role key here.
export const SUPABASE_URL = 'https://megtqbdbjqnvfdquwjqi.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_cyWrNq-iQMzNpWbyHPBw-Q_-r0SIpTD';
export const isSupabaseConfigured = () => /^https:\/\/.+\.supabase\.co$/.test(SUPABASE_URL) && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' && SUPABASE_ANON_KEY.length > 20;
