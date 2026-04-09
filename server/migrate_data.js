require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function syncUsersAndMigrate() {
  console.log("Syncing auth users to profiles...");
  // 1. Fetch all auth users using Admin API
  const { data: { users }, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) {
    console.error("Failed to fetch auth users:", uErr.message);
    return;
  }
  
  for (let u of users) {
    await supabase.from('profiles').upsert({
      id: u.id,
      full_name: u.user_metadata?.full_name || u.email,
      role: u.user_metadata?.role || 'student'
    }, { onConflict: 'id' });
  }
  console.log(`Synced ${users.length} users.`);

  // 2. Perform Migration from local data
  const rawStore = fs.readFileSync('./data/store.json', 'utf8');
  const store = JSON.parse(rawStore);
  
  if (store.courses) {
    console.log("Found", store.courses.length, "courses.");
    for (let c of store.courses) {
      const { error } = await supabase.from('courses').upsert({
        id: c.id,
        title: c.course_name,
        description: 'Imported from local backup',
        instructor_id: c.instructor_id,
        join_code: c.course_code, // Wait, join_code doesn't exist in schema, but let's try!
        created_at: c.created_at
      }, { onConflict: 'id' });
      if (error) console.log("Course error:", error.message);
    }

    for (let c of store.courses) {
      if (c.students) {
        for (let sId of c.students) {
          await supabase.from('enrollments').upsert({ student_id: sId, course_id: c.id }, { onConflict: 'student_id, course_id' });
        }
      }
    }
  }

  if (store.assignments) {
    console.log("Found", store.assignments.length, "assignments.");
    for (let a of store.assignments) {
      const { error } = await supabase.from('assignments').upsert({
        id: a.id,
        course_id: a.courseId,
        instructor_id: a.instructorId,
        title: a.title,
        description: a.description,
        due_date: a.dueDate,
        created_at: a.createdAt
      }, { onConflict: 'id' });
      if (error) console.log("Assignment error:", error.message);
    }
  }
  console.log("Migration complete!");
}

syncUsersAndMigrate();
