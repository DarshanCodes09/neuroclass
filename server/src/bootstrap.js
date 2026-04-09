// server/src/bootstrap.js
// Verifies Supabase connectivity and expected tables on server start.
const supabase = require('./supabase');

const REQUIRED_TABLES = [
  'profiles',
  'courses',
  'uploaded_files',
  'student_queries',
  'course_assets',
  'course_contents',
  'submissions',
  'interactions',
];

async function bootstrapDatabase() {
  console.log('[bootstrap] Checking Supabase connection...');

  // Lightweight ping
  const { error: pingError } = await supabase.from('profiles').select('id').limit(1);
  if (pingError) throw new Error(`Supabase ping failed: ${pingError.message}`);

  // Verify required tables exist
  const missing = [];
  for (const table of REQUIRED_TABLES) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error && error.code === '42P01') missing.push(table); // 42P01 = undefined_table
  }

  if (missing.length) {
    console.warn(
      `[bootstrap] WARNING: These tables are missing in Supabase: ${missing.join(', ')}\n` +
      'Run the SQL migrations in database/ folder via the Supabase SQL Editor.'
    );
  } else {
    console.log(`[bootstrap] ✅ All ${REQUIRED_TABLES.length} required tables present.`);
  }

  // Verify storage buckets
  const REQUIRED_BUCKETS = ['course-materials', 'course-videos', 'profile-avatars', 'student-submissions', 'course-assets', 'submissions'];
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) {
    console.warn('[bootstrap] Could not verify storage buckets:', bucketsError.message);
  } else {
    const existingIds = (buckets || []).map((b) => b.id);
    const missingBuckets = REQUIRED_BUCKETS.filter((b) => !existingIds.includes(b));
    if (missingBuckets.length) {
      console.warn(`[bootstrap] WARNING: Missing storage buckets: ${missingBuckets.join(', ')}`);
    } else {
      console.log(`[bootstrap] ✅ All ${REQUIRED_BUCKETS.length} storage buckets present.`);
    }
  }

  console.log('[bootstrap] Supabase ready.');
}

module.exports = { bootstrapDatabase };
