-- =============================================
-- NEUROCLASS DATABASE SCHEMA
-- Run in: Supabase → SQL Editor
-- =============================================

-- PROFILES (auto-created on auth signup)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name   TEXT,
  role        TEXT CHECK (role IN ('student', 'teacher', 'admin')) DEFAULT 'student',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- COURSES
CREATE TABLE IF NOT EXISTS public.courses (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  teacher_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- UPLOADED FILES
-- Storage path layout:
--   Teacher uploads → course-materials/{courseId}/teacher/{ts}_{file}
--   Student uploads → student-submissions/{courseId}/students/{studentId}/{ts}_{file}
--   Video uploads   → course-videos/{courseId}/teacher/{ts}_{file}
CREATE TABLE IF NOT EXISTS public.uploaded_files (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id       UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  uploader_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploader_role   TEXT CHECK (uploader_role IN ('INSTRUCTOR','STUDENT')) DEFAULT 'STUDENT',
  uploader_name   TEXT,
  file_name       TEXT NOT NULL,
  file_type       TEXT,            -- 'document', 'video', 'image', 'submission', etc.
  storage_bucket  TEXT NOT NULL,   -- 'course-materials' | 'course-videos' | 'student-submissions'
  storage_path    TEXT NOT NULL,   -- full path inside the bucket
  file_size_bytes BIGINT,
  is_public       BOOLEAN DEFAULT FALSE,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- STUDENT TEXT QUERIES (stored for AI training)
CREATE TABLE IF NOT EXISTS public.student_queries (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  course_id     UUID REFERENCES public.courses(id)  ON DELETE SET NULL,
  query_text    TEXT NOT NULL,
  context       TEXT,           -- which file/topic the query relates to
  response_text TEXT,           -- AI response (filled after processing)
  session_id    TEXT,           -- group queries by chat session
  query_type    TEXT DEFAULT 'general',  -- 'general' | 'rag' | 'quiz' | 'file_question'
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ENROLLMENTS
CREATE TABLE IF NOT EXISTS public.enrollments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id   UUID REFERENCES public.courses(id)  ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);

-- =============================================
-- STORAGE BUCKETS
-- =============================================
-- course-materials    → teacher PDFs, slides, docs  (500 MB max per file)
-- course-videos       → teacher video lectures       (2 GB max per file)
-- student-submissions → student assignments          (100 MB max per file)
-- profile-avatars     → public profile pictures      (5 MB max per file)

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('course-materials',    'course-materials',    FALSE, 524288000),
  ('course-videos',       'course-videos',       FALSE, 2147483648),
  ('profile-avatars',     'profile-avatars',     TRUE,  5242880),
  ('student-submissions', 'student-submissions', FALSE, 104857600)
ON CONFLICT (id) DO UPDATE SET
  public          = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;
