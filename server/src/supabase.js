// server/src/supabase.js
// Exports TWO clients:
//   supabase        → anon key  (respects RLS, use for auth-context operations)
//   supabaseAdmin   → service-role key (bypasses RLS, use ONLY in server-side trusted code)
//
// IMPORTANT: Never import supabaseAdmin in frontend/client code.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY    = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[supabase] SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables.'
  );
}

if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    '[supabase] SUPABASE_SERVICE_ROLE_KEY must be set. ' +
    'Without it, all server-side database writes will fail due to RLS. ' +
    'Get it from: Supabase Dashboard → Project Settings → API → service_role key.'
  );
}

// Standard client — respects Row Level Security
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// Admin / service-role client — bypasses RLS (server use only)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Default export: anon client (for any code that does `require('./supabase')`)
module.exports = supabase;

// Named exports: both clients available for explicit import
module.exports.supabase      = supabase;
module.exports.supabaseAdmin = supabaseAdmin;
