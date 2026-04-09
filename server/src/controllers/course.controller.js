const crypto = require('crypto');
const path = require('path');
const { insert, update, find } = require('../store');
const { extractTextFromFile } = require('../utils/parseFile');
const { splitIntoChunks, toTermFreqVector } = require('../utils/vector');
const { createNotification } = require('../services/notification.service');

function generateCourseCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function initializeCourse(req, res) {
  try {
    const {
      courseName,
      academicLevel = 'Undergraduate',
      capacity = 0,
      instructorId,
      instructorName = 'Instructor',
    } = req.body;

    if (!courseName || !instructorId) {
      return res.status(400).json({ error: 'courseName and instructorId are required.' });
    }

    const courseId = crypto.randomUUID();
    const courseCode = generateCourseCode();
    const files = req.files || [];

    insert('courses', {
      id: courseId,
      course_code: courseCode,
      course_name: courseName,
      academic_level: academicLevel,
      capacity: Number(capacity || 0),
      instructor_id: instructorId,
      instructor_name: instructorName,
      students: [],
      status: 'processing',
      created_at: new Date().toISOString(),
    });

    const savedAssets = [];
    for (const file of files) {
      const assetId = crypto.randomUUID();
      const fileType = path.extname(file.originalname).toLowerCase().replace('.', '') || 'unknown';
      const extractedText = await extractTextFromFile(file.path, file.originalname);

      insert('course_assets', {
        id: assetId,
        course_id: courseId,
        file_name: file.originalname,
        file_type: fileType,
        file_path: file.path,
        extracted_text: extractedText,
        created_at: new Date().toISOString(),
      });

      const chunks = splitIntoChunks(extractedText);
      for (const chunk of chunks) {
        const contentId = crypto.randomUUID();
        const vector = toTermFreqVector(chunk);
        insert('course_contents', {
          id: contentId,
          course_id: courseId,
          source_asset_id: assetId,
          content_chunk: chunk,
          vector_json: vector,
          created_at: new Date().toISOString(),
        });
      }

      savedAssets.push({
        id: assetId,
        fileName: file.originalname,
        fileType,
        filePath: file.path,
      });
    }

    update('courses', (c) => c.id === courseId, (c) => ({ ...c, status: 'ready' }));
    await createNotification(instructorId, `Course "${courseName}" initialized successfully.`);

    return res.status(201).json({
      course: {
        id: courseId,
        courseCode,
        courseName,
        academicLevel,
        capacity: Number(capacity || 0),
        instructorId,
        instructorName,
        status: 'ready',
      },
      assets: savedAssets,
      message: 'Course initialized and content pipeline completed.',
    });
  } catch (error) {
    console.error('initializeCourse error:', error);
    return res.status(500).json({ error: 'Failed to initialize course.' });
  }
}

async function listCourses(req, res) {
  try {
    const { instructorId, studentId } = req.query;
    let rows = find('courses');
    if (instructorId) {
      rows = rows.filter((c) => c.instructor_id === instructorId);
    } else if (studentId) {
      rows = rows.filter((c) => Array.isArray(c.students) && c.students.includes(studentId));
    }

    const courses = rows
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map((c) => ({
        id: c.id,
        courseCode: c.course_code,
        courseName: c.course_name,
        academicLevel: c.academic_level,
        capacity: c.capacity,
        instructorId: c.instructor_id,
        instructorName: c.instructor_name,
        students: c.students || [],
        status: c.status,
        createdAt: c.created_at,
      }));

    return res.json({ courses });
  } catch (error) {
    console.error('listCourses error:', error);
    return res.status(500).json({ error: 'Failed to list courses.' });
  }
}

module.exports = {
  initializeCourse,
  listCourses,
};
