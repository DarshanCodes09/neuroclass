const crypto = require('crypto');
const { insert, first, find, update, remove } = require('../store');
const { extractTextFromFile } = require('../utils/parseFile');
const { toTermFreqVector } = require('../utils/vector');
const { createNotification } = require('../services/notification.service');

async function ensureProfile(courseId, instructorId) {
  const existing = first('ai_training_profiles', (p) => p.course_id === courseId);
  if (existing) return existing;

  const profileId = crypto.randomUUID();
  insert('ai_training_profiles', {
    id: profileId,
    course_id: courseId,
    instructor_id: instructorId,
    status: 'calibrating',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return { id: profileId, course_id: courseId, instructor_id: instructorId, status: 'calibrating' };
}

async function uploadRubrics(req, res) {
  try {
    const { courseId, instructorId } = req.body;
    if (!courseId || !instructorId) {
      return res.status(400).json({ error: 'courseId and instructorId are required.' });
    }

    const profile = await ensureProfile(courseId, instructorId);
    const files = req.files || [];
    const result = [];

    for (const file of files) {
      const text = await extractTextFromFile(file.path, file.originalname);
      const id = crypto.randomUUID();
      insert('ai_rubric_files', {
        id,
        profile_id: profile.id,
        course_id: courseId,
        file_name: file.originalname,
        file_path: file.path,
        extracted_text: text,
        created_at: new Date().toISOString(),
      });
      result.push({ id, fileName: file.originalname, extractedCharacters: text.length });
    }

    return res.json({ rubrics: result });
  } catch (error) {
    console.error('uploadRubrics error:', error);
    return res.status(500).json({ error: 'Failed to upload rubric files.' });
  }
}

async function uploadGoldSample(req, res) {
  try {
    const { courseId, instructorId, sampleType, studentAnswer = '', marks, feedback = '' } = req.body;
    if (!courseId || !instructorId || !sampleType) {
      return res.status(400).json({ error: 'courseId, instructorId, and sampleType are required.' });
    }

    const profile = await ensureProfile(courseId, instructorId);
    const file = req.file;
    let answerText = studentAnswer;
    let fileName = null;
    let filePath = null;
    if (file) {
      fileName = file.originalname;
      filePath = file.path;
      const parsed = await extractTextFromFile(file.path, file.originalname);
      if (!answerText) answerText = parsed;
    }

    if (!answerText.trim()) {
      return res.status(400).json({ error: 'studentAnswer text is required (or upload a parseable file).' });
    }

    const id = crypto.randomUUID();
    const vector = toTermFreqVector(answerText);
    insert('ai_gold_samples', {
      id,
      profile_id: profile.id,
      course_id: courseId,
      sample_type: sampleType,
      file_name: fileName,
      file_path: filePath,
      student_answer: answerText,
      marks: Number(marks || 0),
      feedback,
      vector_json: vector,
      created_at: new Date().toISOString(),
    });

    return res.status(201).json({
      sample: {
        id,
        sampleType,
        marks: Number(marks || 0),
        feedback,
        fileName,
      },
    });
  } catch (error) {
    console.error('uploadGoldSample error:', error);
    return res.status(500).json({ error: 'Failed to upload gold sample.' });
  }
}

async function startTraining(req, res) {
  try {
    const { courseId, instructorId } = req.body;
    if (!courseId || !instructorId) {
      return res.status(400).json({ error: 'courseId and instructorId are required.' });
    }
    const profile = await ensureProfile(courseId, instructorId);

    const rubricRows = find('ai_rubric_files', (r) => r.profile_id === profile.id);
    const sampleRows = find('ai_gold_samples', (r) => r.profile_id === profile.id);

    const rubricText = rubricRows.map((r) => r.extracted_text || '').join('\n');
    const rubricVector = toTermFreqVector(rubricText);
    const samples = sampleRows.map((row) => ({
      sampleType: row.sample_type,
      marks: Number(row.marks),
      feedback: row.feedback,
      studentAnswer: row.student_answer,
      vector: toTermFreqVector(row.student_answer || ''),
    }));

    const state = {
      rubricVector,
      sampleCount: samples.length,
      calibratedAt: new Date().toISOString(),
      samples,
    };

    update('ai_training_profiles', (p) => p.id === profile.id, (p) => ({
      ...p,
      status: 'ready',
      rubric_json: { extractedRubricText: rubricText.slice(0, 10000) },
      vector_state: state,
      trained_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    await createNotification(instructorId, 'AI training completed for your course.');
    return res.json({ status: 'ready', sampleCount: samples.length });
  } catch (error) {
    console.error('startTraining error:', error);
    return res.status(500).json({ error: 'Failed to start AI training.' });
  }
}

async function getTrainingProfile(req, res) {
  try {
    const { courseId } = req.params;
    const profile = first('ai_training_profiles', (p) => p.course_id === courseId);
    if (!profile) {
      return res.json({
        profile: {
          status: 'calibrating',
          rubricCount: 0,
          sampleCount: 0,
        },
      });
    }

    const rubricRows = find('ai_rubric_files', (r) => r.profile_id === profile.id);
    const sampleRows = find('ai_gold_samples', (r) => r.profile_id === profile.id);

    return res.json({
      profile: {
        ...profile,
        rubricCount: rubricRows.length,
        sampleCount: sampleRows.length,
      },
      rubrics: rubricRows.map((row) => ({
        id: row.id,
        fileName: row.file_name,
        filePath: row.file_path,
        extractedCharacters: (row.extracted_text || '').length,
      })),
      samples: sampleRows.map((row) => ({
        id: row.id,
        sampleType: row.sample_type,
        type: row.sample_type,
        fileName: row.file_name,
        filePath: row.file_path,
        studentAnswer: row.student_answer,
        marks: Number(row.marks || 0),
        feedback: row.feedback || '',
      })),
    });
  } catch (error) {
    console.error('getTrainingProfile error:', error);
    return res.status(500).json({ error: 'Failed to fetch training profile.' });
  }
}

async function deleteRubric(req, res) {
  try {
    const deleted = remove('ai_rubric_files', (row) => row.id === req.params.rubricId);
    if (!deleted) {
      return res.status(404).json({ error: 'Rubric not found.' });
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error('deleteRubric error:', error);
    return res.status(500).json({ error: 'Failed to delete rubric.' });
  }
}

async function deleteSample(req, res) {
  try {
    const deleted = remove('ai_gold_samples', (row) => row.id === req.params.sampleId);
    if (!deleted) {
      return res.status(404).json({ error: 'Sample not found.' });
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error('deleteSample error:', error);
    return res.status(500).json({ error: 'Failed to delete sample.' });
  }
}

module.exports = {
  uploadRubrics,
  uploadGoldSample,
  startTraining,
  getTrainingProfile,
  deleteRubric,
  deleteSample,
};
