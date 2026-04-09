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

async function uploadRubrics(req, res) {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'files are required.' });
    const { courseId, instructorId } = req.body;
    if (!courseId || !instructorId) return res.status(400).json({ error: 'courseId and instructorId are required.' });

    const profile = await getOrCreateProfile(courseId, instructorId);
    
    const uploadedFiles = [];
    for (const file of req.files) {
      const ext = path.extname(file.originalname);
      const storagePath = `rubric-files/${courseId}/${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;

      const { path: sp, publicUrl } = await uploadToStorage('rubric-files', storagePath, file.buffer, file.mimetype);

      const { data, error } = await sb().from('ai_rubric_files').insert({
        profile_id: profile.id, course_id: courseId, file_name: file.originalname,
        storage_path: sp, public_url: publicUrl,
      }).select().single();
      
      if (!error && data) uploadedFiles.push(data);
    }
    
    return res.status(201).json({ files: uploadedFiles });
  } catch (err) {
    console.error('[training] uploadRubrics error:', err);
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

async function startTraining(req, res) {
  const { courseId } = req.body;
  if (!courseId) return res.status(400).json({ error: 'courseId required' });
  const { data, error } = await sb()
    .from('ai_training_profiles')
    .update({ status: 'trained', trained_at: new Date().toISOString() })
    .eq('course_id', courseId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true, profile: data });
}

async function deleteRubric(req, res) {
  const { rubricId } = req.params;
  const { error } = await sb().from('ai_rubric_files').delete().eq('id', rubricId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
}

async function deleteSample(req, res) {
  const { sampleId } = req.params;
  const { error } = await sb().from('ai_gold_samples').delete().eq('id', sampleId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
}

module.exports = { getProfile, uploadRubrics, addGoldSample, listGoldSamples, startTraining, deleteRubric, deleteSample };
