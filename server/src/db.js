// server/src/db.js
// Single source of truth for the Supabase admin client.
// getAdmin() MUST return the service-role client (supabaseAdmin) so that
// server-side operations bypass Row Level Security.
// The anon client (supabase) is only for auth-gated, user-context operations.

const { supabaseAdmin } = require('./supabase');

/**
 * Returns the Supabase service-role client.
 * This bypasses RLS — only use in trusted server-side code, NEVER in the frontend.
 */
function getAdmin() {
  if (!supabaseAdmin) {
    throw new Error(
      '[db] supabaseAdmin is null. Set SUPABASE_SERVICE_ROLE_KEY in your environment variables.'
    );
  }
  return supabaseAdmin;
}

module.exports = { getAdmin };
