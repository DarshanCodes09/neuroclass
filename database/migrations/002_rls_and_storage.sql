-- =============================================
-- NEUROCLASS — Migration 002: RLS + Storage
-- Already applied live. For docs / local dev.
-- =============================================

-- AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'STUDENT')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS enabled on all tables (see Migration 001 for table definitions)
-- Policies summary:
--   profiles:       users manage own row; instructors see all
--   courses:        all authenticated can read; instructor manages own
--   uploaded_files: enrolled students + instructor can read; uploader manages
--   student_queries:students manage own; instructor reads course queries
--   enrollments:    students manage own; instructor reads course enrollments
--   lectures:       enrolled + instructor can read; instructor manages

-- STORAGE BUCKETS
-- course-materials    (private, 50MB, pdf/doc/ppt/txt/md)
-- course-videos       (private, 500MB, mp4/webm/ogg)
-- profile-avatars     (public,  5MB,  jpg/png/webp/gif)
-- student-submissions (private, 100MB, all types)
-- File path convention: {courseId}/{fileType}/{timestamp}_{sanitizedFilename}
