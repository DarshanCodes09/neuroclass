// server/src/supabase.js
// Supabase admin client (SERVICE ROLE KEY) — server-side only, never expose to client.
// Used by all routes and controllers for DB + Storage operations.
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
    'Copy server/.env.example → server/.env and fill in the values.'
  );
}

const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = supabase;
