-- ================================================================
-- NEUROCLASS AI EVALUATOR TRAINING — Database Schema
-- Run this in Supabase SQL Editor to support instructor-led training
-- ================================================================

-- 1. AI Training Profiles (The 'Brain' of a Course)
CREATE TABLE IF NOT EXISTS public.ai_training_profiles (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id      UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  instructor_id  TEXT NOT NULL,               -- Firebase UID of instructor
  rubric_json    JSONB DEFAULT '{}',          -- The auto-extracted rubric
  vector_state   JSONB DEFAULT '{"samples": []}', -- Aggregated few-shot state
  status         TEXT DEFAULT 'calibrating'   -- 'calibrating' or 'trained'
    CHECK (status IN ('calibrating', 'trained')),
  trained_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id)
);

-- 2. AI Rubric Source Files
CREATE TABLE IF NOT EXISTS public.ai_rubric_files (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id     UUID REFERENCES public.ai_training_profiles(id) ON DELETE CASCADE,
  course_id      UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  file_name      TEXT NOT NULL,
  storage_path   TEXT NOT NULL,               -- Local filesystem path
  public_url     TEXT NOT NULL,               -- HTTP URL for preview
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 3. AI Gold Standard Samples (Calibration Examples)
CREATE TABLE IF NOT EXISTS public.ai_gold_samples (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id     UUID REFERENCES public.ai_training_profiles(id) ON DELETE CASCADE,
  course_id      UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  sample_type    TEXT NOT NULL                -- 'high', 'avg', 'low'
    CHECK (sample_type IN ('high', 'avg', 'low')),
  student_answer TEXT NOT NULL,
  marks          NUMERIC NOT NULL,
  feedback       TEXT,
  vector_json    JSONB DEFAULT '{}',          -- Term freq vector for similarity
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_profiles_course      ON public.ai_training_profiles(course_id);
CREATE INDEX IF NOT EXISTS idx_ai_rubrics_course       ON public.ai_rubric_files(course_id);
CREATE INDEX IF NOT EXISTS idx_ai_samples_course       ON public.ai_gold_samples(course_id);
CREATE INDEX IF NOT EXISTS idx_ai_samples_type         ON public.ai_gold_samples(sample_type);

-- Enable RLS
ALTER TABLE public.ai_training_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_rubric_files     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_gold_samples      ENABLE ROW LEVEL SECURITY;

-- Service Role Policies (Backend bypass)
CREATE POLICY "service_all" ON public.ai_training_profiles FOR ALL USING (true);
CREATE POLICY "service_all" ON public.ai_rubric_files     FOR ALL USING (true);
CREATE POLICY "service_all" ON public.ai_gold_samples     FOR ALL USING (true);
