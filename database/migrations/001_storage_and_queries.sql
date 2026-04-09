-- ============================================================
-- Migration 001: Add uploaded_files + student_queries tables
-- Run this in Supabase SQL Editor if schema.sql was already
-- applied without these two tables.
-- ============================================================

-- uploaded_files: tracks every file in Supabase Storage
CREATE TABLE IF NOT EXISTS public.uploaded_files (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id       UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  uploader_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name       TEXT NOT NULL,
  file_type       TEXT DEFAULT 'document',
  storage_bucket  TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  file_size_bytes BIGINT,
  is_public       BOOLEAN DEFAULT FALSE,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT timezone('utc', now())
);
ALTER TABLE public.uploaded_files DISABLE ROW LEVEL SECURITY;

-- student_queries: every student text query + AI reply
CREATE TABLE IF NOT EXISTS public.student_queries (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  course_id   UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  query_text  TEXT NOT NULL,
  ai_reply    TEXT,
  context     TEXT,
  thread_id   TEXT,
  provider    TEXT DEFAULT 'gemini',
  query_type  TEXT DEFAULT 'general',
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT timezone('utc', now())
);
ALTER TABLE public.student_queries DISABLE ROW LEVEL SECURITY;

-- ── Storage bucket policies ───────────────────────────────────
-- (Run after creating buckets manually in Supabase Storage UI)

-- course-materials (private)
CREATE POLICY IF NOT EXISTS "Authenticated upload course-materials"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-materials');

CREATE POLICY IF NOT EXISTS "Authenticated read course-materials"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'course-materials');

CREATE POLICY IF NOT EXISTS "Owner delete course-materials"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'course-materials' AND owner = auth.uid());

-- course-videos (private)
CREATE POLICY IF NOT EXISTS "Authenticated upload course-videos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-videos');

CREATE POLICY IF NOT EXISTS "Authenticated read course-videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'course-videos');

-- profile-avatars (public)
CREATE POLICY IF NOT EXISTS "Public read profile-avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-avatars');

CREATE POLICY IF NOT EXISTS "Authenticated upload profile-avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-avatars');

-- student-submissions (private)
CREATE POLICY IF NOT EXISTS "Authenticated upload student-submissions"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'student-submissions');

CREATE POLICY IF NOT EXISTS "Authenticated read student-submissions"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'student-submissions');
