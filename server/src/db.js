// server/src/db.js
// Single source of truth for the Supabase admin client.
// Both legacy code (getAdmin) and new code (require('./supabase')) work.
const supabase = require('./supabase');

/** Returns the shared Supabase service-role client */
function getAdmin() {
  return supabase;
}

module.exports = { getAdmin };
