-- ================================================================
-- NEUROCLASS AI EVALUATOR — Database Tables
-- Run this in Supabase SQL Editor
-- ================================================================

-- 1. Subjects
CREATE TABLE IF NOT EXISTS public.eval_subjects (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Rubrics (PDF → JSON)
CREATE TABLE IF NOT EXISTS public.eval_rubrics (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id  UUID REFERENCES public.eval_subjects(id) ON DELETE CASCADE,
  rubric_json JSONB NOT NULL,
  raw_text    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Gold Standard Samples (few-shot learning)
CREATE TABLE IF NOT EXISTS public.eval_samples (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id  UUID REFERENCES public.eval_subjects(id) ON DELETE CASCADE,
  answer      TEXT NOT NULL,
  marks       NUMERIC NOT NULL,
  feedback    TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('high', 'medium', 'low')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Assignments
CREATE TABLE IF NOT EXISTS public.eval_assignments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id  UUID REFERENCES public.eval_subjects(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('theory', 'coding', 'math')),
  question    TEXT NOT NULL,
  test_cases  JSONB,
  total_marks NUMERIC NOT NULL DEFAULT 10,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Submissions (AI evaluation results)
CREATE TABLE IF NOT EXISTS public.eval_submissions (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id  UUID REFERENCES public.eval_assignments(id) ON DELETE CASCADE,
  student_answer TEXT NOT NULL,
  file_url       TEXT,                        -- optional: URL if submitted via file upload
  submission_type TEXT DEFAULT 'text'         -- 'text' or 'file'
    CHECK (submission_type IN ('text', 'file')),
  ai_marks       JSONB DEFAULT '{}',
  ai_total       NUMERIC,
  feedback       TEXT,
  confidence     NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_eval_rubrics_subject    ON public.eval_rubrics(subject_id);
CREATE INDEX IF NOT EXISTS idx_eval_samples_subject    ON public.eval_samples(subject_id);
CREATE INDEX IF NOT EXISTS idx_eval_samples_type       ON public.eval_samples(type);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_subject ON public.eval_assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_eval_submissions_assignment ON public.eval_submissions(assignment_id);

-- Disable RLS for service role access (or add policies as needed)
ALTER TABLE public.eval_subjects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_rubrics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_samples     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_submissions ENABLE ROW LEVEL SECURITY;

-- Allow full access via service role (used by backend)
CREATE POLICY "service_all" ON public.eval_subjects    FOR ALL USING (true);
CREATE POLICY "service_all" ON public.eval_rubrics     FOR ALL USING (true);
CREATE POLICY "service_all" ON public.eval_samples     FOR ALL USING (true);
CREATE POLICY "service_all" ON public.eval_assignments FOR ALL USING (true);
CREATE POLICY "service_all" ON public.eval_submissions FOR ALL USING (true);

-- Storage bucket for rubric PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('rubric-files', 'rubric-files', FALSE, 20971520)
ON CONFLICT (id) DO NOTHING;
