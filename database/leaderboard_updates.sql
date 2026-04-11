-- ================================================================
-- LEADERBOARD UPDATES (Run in Supabase SQL Editor)
-- ================================================================

-- 1. Add student_id to eval_submissions
ALTER TABLE public.eval_submissions 
ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_eval_submissions_student ON public.eval_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_eval_submissions_score ON public.eval_submissions(ai_total);

-- 3. Update existing submissions to link to a student if possible (Migration)
-- (Assuming most submissions were created by the current user profile)
-- UPDATE public.eval_submissions SET student_id = '...' WHERE student_id IS NULL;
