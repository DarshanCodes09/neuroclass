-- ================================================================
-- NEUROCLASS RLS POLICIES (Run in Supabase SQL Editor)
-- ================================================================

-- ── 1. PROFILES POLICIES ───────────────────────────────────────
-- Allow users to see their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

-- Allow users to update their own profile (crucial for role assignment)
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- Allow users to insert their own profile (fallback if trigger fails)
CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Allow public read access to instructor names (needed for course listings)
CREATE POLICY "Profiles are publicly readable" 
ON public.profiles FOR SELECT 
USING (true);

-- ── 2. COURSES POLICIES ────────────────────────────────────────
-- Allow anyone to see courses
CREATE POLICY "Courses are viewable by everyone" 
ON public.courses FOR SELECT 
USING (true);

-- Only instructors can create courses
CREATE POLICY "Only teachers can create courses" 
ON public.courses FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'teacher'
  )
);

-- Only course owner can update/delete
CREATE POLICY "Instructors can manage own courses" 
ON public.courses FOR ALL 
USING (instructor_id = auth.uid());

-- ── 3. ENROLLMENTS ─────────────────────────────────────────────
CREATE POLICY "Students can view own enrollments" 
ON public.enrollments FOR SELECT 
USING (student_id = auth.uid());

CREATE POLICY "Students can enroll themselves" 
ON public.enrollments FOR INSERT 
WITH CHECK (student_id = auth.uid());
