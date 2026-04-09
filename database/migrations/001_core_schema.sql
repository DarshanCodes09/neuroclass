-- =============================================
-- NEUROCLASS — Migration 001: Core Schema
-- Run via Supabase Dashboard > SQL Editor
-- OR use: supabase db push
-- =============================================
-- NOTE: This schema already matches what is live in Supabase.
-- This file is for documentation and local dev use only.
-- =============================================

-- USER PROFILES (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  full_name  TEXT NOT NULL DEFAULT '',
  role       TEXT NOT NULL DEFAULT 'STUDENT'
               CHECK (role IN ('STUDENT','INSTRUCTOR','ADMIN')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- COURSES
CREATE TABLE IF NOT EXISTS public.courses (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  instructor_id UUID NOT NULL REFERENCES public.profiles(id),
  join_code     TEXT UNIQUE DEFAULT SUBSTRING(md5(random()::text) FROM 1 FOR 8),
  pedagogy      TEXT NOT NULL DEFAULT 'SOCRATIC'
                  CHECK (pedagogy IN ('SOCRATIC','SCAFFOLDED','DIRECT','PROJECT_BASED')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ENROLLMENTS (user_id = student)
CREATE TABLE IF NOT EXISTS public.enrollments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- UPLOADED FILES — central storage index
-- Storage path: {courseId}/{fileType}/{timestamp}_{filename}
CREATE TABLE IF NOT EXISTS public.uploaded_files (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id        UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  uploader_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  file_name        TEXT NOT NULL,
  file_type        TEXT,  -- 'pdf','video','document','submission','avatar'
  storage_bucket   TEXT NOT NULL,
  storage_path     TEXT NOT NULL,
  file_size_bytes  BIGINT,
  is_public        BOOLEAN DEFAULT FALSE,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- STUDENT QUERIES — every question a student asks (for AI training)
CREATE TABLE IF NOT EXISTS public.student_queries (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  course_id  UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  thread_id  UUID DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  ai_reply   TEXT,
  provider   TEXT DEFAULT 'gemini',
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LECTURES
CREATE TABLE IF NOT EXISTS public.lectures (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id  UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  file_url   TEXT,
  file_type  TEXT CHECK (file_type IN ('pdf','markdown','txt')),
  status     TEXT DEFAULT 'uploaded'
               CHECK (status IN ('uploaded','processing','embedded','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
