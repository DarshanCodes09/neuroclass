const path = require('path');
const { getAdmin } = require('../db');
const { uploadToStorage, cleanupLocal } = require('../utils/upload');
const { toTermFreqVector } = require('../utils/vector');

function sb() { return getAdmin(); }

async function createCourse(req, res) {
  const { title, description = '', instructorId, pedagogy = 'SOCRATIC' } = req.body;
  if (!title || !instructorId) return res.status(400).json({ error: 'title and instructorId are required.' });

  const { data, error } = await sb().from('courses').insert({
    title, description, instructor_id: instructorId, pedagogy,
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(201).json({ course: data });
}

async function listCourses(req, res) {
  const { instructorId, studentId } = req.query;
  let query = sb().from('courses').select('*');

  if (instructorId) {
    query = query.eq('instructor_id', instructorId);
  } else if (studentId) {
    const { data: enrollments } = await sb().from('enrollments').select('course_id').eq('student_id', studentId);
    const ids = (enrollments || []).map((e) => e.course_id);
    if (!ids.length) return res.json({ courses: [] });
    query = query.in('id', ids);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  
  // Need to manually fetch instructor names for each course since we don't have a direct join setup in the same query shape
  const coursesWithDetails = await Promise.all((data || []).map(async (course) => {
    let instructorName = 'Unknown Instructor';
    if (course.instructor_id) {
      const { data: profile } = await sb().from('profiles').select('full_name').eq('id', course.instructor_id).single();
      if (profile) instructorName = profile.full_name;
    }
    
    // Also fetch students count for UI
    const { data: students } = await sb().from('enrollments').select('student_id').eq('course_id', course.id);

    return {
      id: course.id,
      courseCode: course.join_code || 'N/A',
      courseName: course.title,
      description: course.description,
      instructorId: course.instructor_id,
      instructorName: instructorName,
      pedagogyStyle: course.pedagogy,
      academicLevel: 'Undergraduate',
      students: students ? students.map(s => s.student_id) : [],
      capacity: 50,
      createdAt: course.created_at
    };
  }));

  return res.json({ courses: coursesWithDetails });
}

async function uploadCourseAsset(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required.' });
    const { courseId } = req.body;
    if (!courseId) return res.status(400).json({ error: 'courseId is required.' });

    const ext = path.extname(req.file.originalname);
    const storagePath = `courses/${courseId}/${Date.now()}${ext}`;

    const { path: sp, publicUrl } = await uploadToStorage(
      'course-assets', storagePath, req.file.buffer, req.file.mimetype
    );

    // Insert metadata record
    const { data, error } = await sb().from('course_assets').insert({
      course_id: courseId,
      file_name: req.file.originalname,
      file_type: req.file.mimetype,
      storage_path: sp,
      public_url: publicUrl,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });

    return res.status(201).json({ asset: data });
  } catch (err) {
    console.error('[course] uploadCourseAsset error:', err);
    return res.status(500).json({ error: 'Upload failed.' });
  }
}

async function initializeCourse(req, res) {
  try {
    const { courseName, academicLevel, capacity, instructorId, pedagogy } = req.body;
    if (!courseName || !instructorId) return res.status(400).json({ error: 'courseName and instructorId are required.' });

    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // 1. Create the course
    const { data: course, error } = await sb().from('courses').insert({
      title: courseName,
      instructor_id: instructorId,
      join_code: joinCode,
      pedagogy: pedagogy || 'SOCRATIC',
      description: `Targeting ${academicLevel || 'Undergraduate'} with capacity ${capacity || 30}`
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });

    // 2. Upload context files securely to Supabase Storage if any exist
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const ext = path.extname(file.originalname);
        const storagePath = `course-materials/${course.id}/${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
        
        try {
          const { path: sp, publicUrl } = await uploadToStorage('course-materials', storagePath, file.buffer, file.mimetype);
          
          await sb().from('uploaded_files').insert({
            course_id: course.id,
            file_name: file.originalname,
            file_type: 'context',
            storage_path: sp,
            storage_bucket: 'course-materials',
            metadata: { public_url: publicUrl, size: file.size, mime_type: file.mimetype }
          });
        } catch (uploadErr) {
          console.error(`Skipping file upload for ${file.originalname}:`, uploadErr);
        }
      }
    }

    return res.status(201).json({ course });
  } catch (err) {
    console.error('[course] initializeCourse error:', err);
    return res.status(500).json({ error: 'Failed to initialize course.' });
  }
}

module.exports = { createCourse, listCourses, uploadCourseAsset, initializeCourse };
