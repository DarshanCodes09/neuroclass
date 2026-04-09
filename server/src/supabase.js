// server/src/supabase.js
// Supabase admin client — SERVICE ROLE KEY, server-side ONLY.
// NEVER import this file in client-side (browser) code.
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
    persistSession:   false,
  },
});

module.exports = supabase;
