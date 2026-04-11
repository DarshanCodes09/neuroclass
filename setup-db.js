const { Client } = require('pg');

// ⚠️ REPLACE THIS WITH YOUR ACTUAL PASSWORD 
const DATABASE_PASSWORD = "(Darshan512006)";

// Do not change these unless your Supabase details change
const connectionString = `postgres://postgres:${DATABASE_PASSWORD}@db.qpxujurhhknpqiwzkomx.supabase.co:5432/postgres`;

// The SQL commands to build your database
const sql = `
-- 1. Create the Users Table
CREATE TABLE IF NOT EXISTS users (
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  email text NOT NULL,
  name text,
  role text DEFAULT 'Student'
);

-- 2. Create the Courses Table
CREATE TABLE IF NOT EXISTS courses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "courseCode" text NOT NULL,
  "courseName" text NOT NULL,
  "academicLevel" text,
  "capacity" text,
  "instructorId" uuid REFERENCES users(id),
  "instructorName" text,
  "students" uuid[] DEFAULT '{}',
  "createdAt" timestamp with time zone DEFAULT now()
);

-- 3. Create the Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "courseId" uuid REFERENCES courses(id),
  title text NOT NULL,
  description text,
  "dueDate" timestamp with time zone
);

-- Enable RLS to stop silent errors for now (you can tighten these later)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write" ON courses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write" ON assignments FOR ALL USING (true) WITH CHECK (true);
`;

async function runSetup() {
  if (DATABASE_PASSWORD === "YOUR_DATABASE_PASSWORD_HERE") {
    console.error("❌ ERROR: You forgot to paste your database password into setup-db.js!");
    process.exit(1);
  }

  const client = new Client({
    connectionString: connectionString,
  });

  try {
    console.log("Connecting to Supabase...");
    await client.connect();

    console.log("Running SQL commands...");
    await client.query(sql);

    console.log("✅ Success! All tables strictly created in your Supabase.");
    console.log("You can delete this script file now.");
  } catch (err) {
    console.error("❌ Failed to create tables:", err);
  } finally {
    await client.end();
  }
}

runSetup();
