/**
 * bootstrap.js
 *
 * Database tables are now managed via Supabase migrations.
 * This file verifies connectivity and logs a confirmation.
 */
const { getAdmin } = require('./db');

async function bootstrapDatabase() {
  try {
    const sb = getAdmin();
    // Quick connectivity check
    const { error } = await sb.from('profiles').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message);
    }
    console.log('[bootstrap] Supabase connection verified.');
  } catch (err) {
    console.error('[bootstrap] Supabase connection error:', err.message);
    throw err;
  }
}

module.exports = { bootstrapDatabase };
