-- Update submissions table to support plagiarism check and detailed justification
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS student_answer TEXT,
ADD COLUMN IF NOT EXISTS vector_json JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS plagiarism_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_marks JSONB DEFAULT '{}';

-- Create an index for faster assignment-based plagiarism checks
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_similarity ON public.submissions(assignment_id);
