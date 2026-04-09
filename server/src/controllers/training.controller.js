const path = require('path');
const { getAdmin } = require('../db');
const { uploadToStorage, cleanupLocal } = require('../utils/upload');
const { toTermFreqVector } = require('../utils/vector');

function sb() { return getAdmin(); }

async function getOrCreateProfile(courseId, instructorId) {
  const { data: existing } = await sb().from('ai_training_profiles').select('*').eq('course_id', courseId).single();
  if (existing) return existing;
  const { data, error } = await sb().from('ai_training_profiles').insert({ course_id: courseId, instructor_id: instructorId }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function getProfile(req, res) {
  const { courseId } = req.params;
  const { data, error } = await sb().from('ai_training_profiles').select('*').eq('course_id', courseId).single();
  if (error) return res.status(404).json({ error: 'Profile not found.' });
  return res.json({ profile: data });
}

async function uploadRubricFile(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required.' });
    const { courseId, instructorId } = req.body;
    if (!courseId || !instructorId) return res.status(400).json({ error: 'courseId and instructorId are required.' });

    const profile = await getOrCreateProfile(courseId, instructorId);
    const ext = path.extname(req.file.originalname);
    const storagePath = `rubric-files/${courseId}/${Date.now()}${ext}`;

    const { path: sp, publicUrl } = await uploadToStorage('rubric-files', storagePath, req.file.path, req.file.mimetype);
    cleanupLocal(req.file.path);

    const { data, error } = await sb().from('ai_rubric_files').insert({
      profile_id: profile.id, course_id: courseId, file_name: req.file.originalname,
      storage_path: sp, public_url: publicUrl,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ file: data });
  } catch (err) {
    console.error('[training] uploadRubricFile error:', err);
    return res.status(500).json({ error: 'Upload failed.' });
  }
}

async function addGoldSample(req, res) {
  try {
    const { courseId, instructorId, sampleType, studentAnswer, marks, feedback } = req.body;
    if (!courseId || !instructorId || !sampleType || !studentAnswer || marks === undefined || !feedback)
      return res.status(400).json({ error: 'Missing required fields.' });

    const profile = await getOrCreateProfile(courseId, instructorId);
    const vectorJson = toTermFreqVector(studentAnswer);

    const { data, error } = await sb().from('ai_gold_samples').insert({
      profile_id: profile.id, course_id: courseId,
      sample_type: sampleType, student_answer: studentAnswer,
      marks: Number(marks), feedback, vector_json: vectorJson,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });

    // Rebuild vector_state
    const { data: allSamples } = await sb().from('ai_gold_samples').select('*').eq('course_id', courseId);
    const vectorState = {
      samples: (allSamples || []).map((s) => ({
        sampleType: s.sample_type, marks: s.marks, feedback: s.feedback, vector: s.vector_json,
      })),
      updatedAt: new Date().toISOString(),
    };
    await sb().from('ai_training_profiles').update({
      vector_state: vectorState, status: 'trained', trained_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', profile.id);

    return res.status(201).json({ sample: data });
  } catch (err) {
    console.error('[training] addGoldSample error:', err);
    return res.status(500).json({ error: 'Failed to add gold sample.' });
  }
}

async function listGoldSamples(req, res) {
  const { courseId } = req.params;
  const { data, error } = await sb().from('ai_gold_samples').select('*').eq('course_id', courseId).order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ samples: data || [] });
}

module.exports = { getProfile, uploadRubricFile, addGoldSample, listGoldSamples };
