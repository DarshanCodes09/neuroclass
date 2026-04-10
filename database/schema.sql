-- ================================================================
-- NEUROCLASS — SUPABASE SCHEMA (Applied Migrations)
-- Run in Supabase SQL Editor if setting up from scratch
-- ================================================================

-- ── PROFILES (extends auth.users) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name   TEXT,
  role        TEXT CHECK (role IN ('student','teacher','admin')) DEFAULT 'student',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ── COURSES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  instructor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- ── ENROLLMENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enrollments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id   UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- ── UPLOADED FILES (systematic storage tracking) ────────────────
-- Storage path: {courseId}/{teacher|students/{userId}}/{ts}_{filename}
CREATE TABLE IF NOT EXISTS public.uploaded_files (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id        UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  uploader_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploader_role    TEXT DEFAULT 'STUDENT',  -- 'INSTRUCTOR' | 'STUDENT'
  file_name        TEXT NOT NULL,
  file_type        TEXT,
  category         TEXT DEFAULT 'document'
    CHECK (category IN ('document','video','image','audio','assignment','resource','other')),
  storage_bucket   TEXT NOT NULL,
  storage_path     TEXT NOT NULL,
  file_size_bytes  BIGINT,
  is_public        BOOLEAN DEFAULT FALSE,
  tags             TEXT[] DEFAULT '{}',
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.uploaded_files ENABLE ROW LEVEL SECURITY;

-- ── STUDENT QUERIES (every query stored for AI training) ─────────
CREATE TABLE IF NOT EXISTS public.student_queries (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  course_id     UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  thread_id     UUID DEFAULT gen_random_uuid(),
  session_id    TEXT,
  query_text    TEXT NOT NULL,
  ai_reply      TEXT,
  response_text TEXT,
  provider      TEXT DEFAULT 'gemini',
  query_type    TEXT DEFAULT 'general',
  context       TEXT,
  metadata      JSONB DEFAULT '{}',
  file_reference_id UUID REFERENCES public.uploaded_files(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.student_queries ENABLE ROW LEVEL SECURITY;

-- ── INDEXES ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_uploaded_files_course_id    ON public.uploaded_files(course_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_category     ON public.uploaded_files(category);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_created_at   ON public.uploaded_files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_queries_student_id  ON public.student_queries(student_id);
CREATE INDEX IF NOT EXISTS idx_student_queries_course_id   ON public.student_queries(course_id);
CREATE INDEX IF NOT EXISTS idx_student_queries_session_id  ON public.student_queries(session_id);
CREATE INDEX IF NOT EXISTS idx_student_queries_fulltext
  ON public.student_queries USING gin(to_tsvector('english', query_text));

-- ── STORAGE BUCKETS ──────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('course-materials',   'course-materials',   FALSE, 52428800,  NULL),
  ('course-videos',      'course-videos',      FALSE, 524288000, NULL),
  ('profile-avatars',    'profile-avatars',    TRUE,  5242880,   NULL),
  ('student-submissions','student-submissions', FALSE, 52428800,  NULL)
ON CONFLICT (id) DO NOTHING;

-- ── HELPER VIEWS FOR AI TRAINING ─────────────────────────────────
CREATE OR REPLACE VIEW public.v_training_queries AS
  SELECT sq.id, sq.query_text, sq.ai_reply, sq.response_text,
         sq.query_type, sq.context, sq.session_id, sq.thread_id,
         sq.provider, sq.created_at,
         c.title AS course_title,
         p.full_name AS student_name, p.role AS student_role
  FROM   public.student_queries sq
  LEFT JOIN public.courses c  ON c.id = sq.course_id
  LEFT JOIN public.profiles p ON p.id = sq.student_id;

CREATE OR REPLACE VIEW public.v_file_inventory AS
  SELECT uf.id, uf.file_name, uf.file_type, uf.category,
         uf.storage_bucket, uf.storage_path, uf.file_size_bytes,
         uf.is_public, uf.tags, uf.created_at,
         c.title AS course_title, p.full_name AS uploader_name
  FROM   public.uploaded_files uf
  LEFT JOIN public.courses c  ON c.id = uf.course_id
  LEFT JOIN public.profiles p ON p.id = uf.uploader_id;

-- ── AUTO-UPDATE updated_at ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_uploaded_files_updated_at
  BEFORE UPDATE ON public.uploaded_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_student_queries_updated_at
  BEFORE UPDATE ON public.student_queries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── AUTO-CREATE PROFILE ON SIGNUP ────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
