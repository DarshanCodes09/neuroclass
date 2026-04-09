// server/src/bootstrap.js
// Runs on startup: verifies Supabase connection and logs table status.
const supabase = require('./supabase');

async function bootstrapDatabase() {
  console.log('[bootstrap] Checking Supabase connection...');

  const checks = [
    'profiles',
    'courses',
    'uploaded_files',
    'student_queries',
    'enrollments',
    'notifications',
  ];

  for (const table of checks) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      // Table might not exist yet — warn but don't crash
      console.warn(`[bootstrap] ⚠️  Table "${table}" not ready: ${error.message}`);
      console.warn(`[bootstrap]    → Run database/schema.sql in your Supabase SQL Editor.`);
    } else {
      console.log(`[bootstrap] ✅  Table "${table}" OK`);
    }
  }

  // Verify storage buckets exist
  const requiredBuckets = ['course-materials', 'course-videos', 'profile-avatars', 'student-submissions'];
  const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
  if (bucketErr) {
    console.warn('[bootstrap] ⚠️  Could not list storage buckets:', bucketErr.message);
  } else {
    const existing = buckets.map(b => b.name);
    for (const bucket of requiredBuckets) {
      if (existing.includes(bucket)) {
        console.log(`[bootstrap] ✅  Bucket "${bucket}" OK`);
      } else {
        console.warn(`[bootstrap] ⚠️  Bucket "${bucket}" missing — create it in Supabase Dashboard → Storage`);
      }
    }
  }

  console.log('[bootstrap] ✅ Supabase bootstrap complete.');
}

module.exports = { bootstrapDatabase };
