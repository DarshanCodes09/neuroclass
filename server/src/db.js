const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.warn('[db] SUPABASE_URL not set. Supabase client will be unavailable.');
}

/**
 * Service-role client — bypasses RLS.
 * Use ONLY in server-side code (controllers, services).
 * Never expose the service role key to the client.
 */
const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })
  : null;

/**
 * Anon client — respects RLS.
 * Used when acting on behalf of an authenticated user.
 */
const supabaseAnon = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Returns the admin (service-role) client.
 * Throws if not configured.
 */
function getAdmin() {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabaseAdmin;
}

/**
 * Returns the anon client.
 */
function getAnon() {
  if (!supabaseAnon) {
    throw new Error('Supabase anon client not configured. Check SUPABASE_URL and SUPABASE_ANON_KEY.');
  }
  return supabaseAnon;
}

module.exports = {
  supabaseAdmin,
  supabaseAnon,
  getAdmin,
  getAnon,
};
