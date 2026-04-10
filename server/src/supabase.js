// server/src/supabase.js
// Exports TWO clients:
//   supabase        → anon key  (respects RLS, use for auth-gated operations)
//   supabaseAdmin   → service key (bypasses RLS, use ONLY in server-side trusted code)

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY    = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables.');
}

// Standard client — respects Row Level Security
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// Admin client — bypasses RLS (server use only, never expose to frontend)
const supabaseAdmin = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

if (!supabaseAdmin) {
  console.warn('[supabase] SUPABASE_SERVICE_ROLE_KEY not set — admin client unavailable.');
}

module.exports = supabase;
module.exports.supabaseAdmin = supabaseAdmin;
