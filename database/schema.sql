-- ============================================================
-- NeuroClass — Full Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- Project: tvizwaysproajwebglwv
-- ============================================================

-- ── PROFILES (extends Supabase Auth) ────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT,
  role         TEXT CHECK (role IN ('student','teacher','admin')) DEFAULT 'student',
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── COURSES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  instructor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── ENROLLMENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enrollments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id   UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, course_id)
);

-- ── UPLOADED FILES (Supabase Storage metadata) ───────────────
-- Tracks every file uploaded to any bucket.
-- storage_path matches the exact path inside the bucket.
CREATE TABLE IF NOT EXISTS public.uploaded_files (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id        UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  uploader_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  file_name        TEXT NOT NULL,
  file_type        TEXT,           -- 'pdf','video','document','image','submission','avatar'
  storage_bucket   TEXT NOT NULL,  -- 'course-materials','course-videos', etc.
  storage_path     TEXT NOT NULL,  -- full path inside bucket e.g. {courseId}/pdf/2024-01-01_ts_file.pdf
  file_size_bytes  BIGINT,
  is_public        BOOLEAN DEFAULT FALSE,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── COURSE ASSETS (AI-processed files with extracted text) ───
CREATE TABLE IF NOT EXISTS public.course_assets (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id      UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  file_name      TEXT NOT NULL,
  file_type      TEXT NOT NULL,
  storage_path   TEXT NOT NULL,
  public_url     TEXT,
  extracted_text TEXT,  -- raw text extracted for RAG
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── COURSE CONTENTS (RAG chunks from course assets) ──────────
CREATE TABLE IF NOT EXISTS public.course_contents (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id     UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  source_asset_id UUID REFERENCES public.course_assets(id) ON DELETE CASCADE,
  content_chunk TEXT NOT NULL,  -- one text chunk for vector search
  vector_json   JSONB DEFAULT '{}',  -- TF-IDF or embedding stored as JSON
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── STUDENT QUERIES (every student chat message + AI reply) ──
-- Primary training data for LangChain / LangGraph agents.
CREATE TABLE IF NOT EXISTS public.student_queries (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  course_id   UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  thread_id   UUID DEFAULT gen_random_uuid(),  -- groups a conversation session
  query_text  TEXT NOT NULL,
  ai_reply    TEXT,
  provider    TEXT DEFAULT 'gemini',  -- 'gemini','anthropic','offline'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── INTERACTIONS (full message log for LangGraph checkpoints) ─
CREATE TABLE IF NOT EXISTS public.interactions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  course_id  UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  thread_id  UUID,
  role       TEXT CHECK (role IN ('user','ai','system')) NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ASSIGNMENTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assignments (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id     UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  max_score     NUMERIC DEFAULT 100,
  due_date      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── SUBMISSIONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.submissions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id     UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  course_id         UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  instructor_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  student_id        UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path      TEXT,
  file_url          TEXT,
  file_name         TEXT,
  submitted_at      TIMESTAMPTZ DEFAULT NOW(),
  status            TEXT DEFAULT 'evaluated',
  ai_score          NUMERIC DEFAULT 0,
  ai_feedback       TEXT DEFAULT '',
  final_score       NUMERIC,
  max_score         NUMERIC DEFAULT 100,
  instructor_feedback TEXT
);

-- ── ANNOUNCEMENTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id    UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  text         TEXT NOT NULL,
  author_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name  TEXT DEFAULT 'User',
  author_photo TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── AI TRAINING PROFILES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_training_profiles (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id      UUID UNIQUE REFERENCES public.courses(id) ON DELETE CASCADE,
  instructor_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status         TEXT DEFAULT 'calibrating',
  rubric_json    JSONB,
  vector_state   JSONB,
  trained_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── AI GOLD SAMPLES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_gold_samples (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id  UUID REFERENCES public.ai_training_profiles(id) ON DELETE CASCADE,
  sample_type TEXT,
  content     TEXT,
  marks       NUMERIC,
  feedback    TEXT,
  vector      JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── NOTIFICATIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUTO-CREATE PROFILE ON AUTH SIGNUP
-- ============================================================
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

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_files    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_assets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_contents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_queries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_training_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_gold_samples   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users view own profile"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Courses
CREATE POLICY "Authenticated view courses"    ON public.courses FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Instructors create courses"    ON public.courses FOR INSERT TO authenticated WITH CHECK (auth.uid() = instructor_id);
CREATE POLICY "Instructors update own course" ON public.courses FOR UPDATE USING (auth.uid() = instructor_id);

-- Enrollments
CREATE POLICY "Students see own enrollments" ON public.enrollments FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students can enroll"          ON public.enrollments FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);

-- Uploaded files
CREATE POLICY "Uploaders can insert files"  ON public.uploaded_files FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "Enrolled users view files"   ON public.uploaded_files FOR SELECT TO authenticated USING (
  is_public = TRUE OR uploader_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.enrollments WHERE student_id = auth.uid() AND course_id = uploaded_files.course_id)
);
CREATE POLICY "Uploaders delete own files"  ON public.uploaded_files FOR DELETE USING (auth.uid() = uploader_id);

-- Student queries
CREATE POLICY "Students insert own queries" ON public.student_queries FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students view own queries"   ON public.student_queries FOR SELECT USING (auth.uid() = student_id);

-- Notifications
CREATE POLICY "Users see own notifications"    ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
