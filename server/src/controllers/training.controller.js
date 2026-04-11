const path = require('path');
const { getAdmin } = require('../db');
const { uploadToStorage, cleanupLocal } = require('../utils/upload');
const { toTermFreqVector } = require('../utils/vector');
const pdfParse = require('pdf-parse');
const { generateText } = require('./ai.controller');

function sb() { return getAdmin(); }

async function resolveCourseId(courseIdOrCode) {
  if (!courseIdOrCode) return null;
  if (courseIdOrCode.length === 36) return courseIdOrCode; // Valid UUID
  const { data } = await sb().from('courses').select('id').eq('join_code', courseIdOrCode.toUpperCase()).single();
  return data ? data.id : null;
}

async function getOrCreateProfile(courseId, instructorId) {
  const { data: existing } = await sb().from('ai_training_profiles').select('*').eq('course_id', courseId).single();
  if (existing) return existing;
  const { data, error } = await sb().from('ai_training_profiles').insert({ course_id: courseId, instructor_id: instructorId }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function getProfile(req, res) {
  let { courseId } = req.params;
  courseId = await resolveCourseId(courseId);
  if (!courseId) return res.status(404).json({ error: 'Course not found.' });

  const { data, error } = await sb().from('ai_training_profiles').select('*').eq('course_id', courseId).single();
  if (error) return res.status(404).json({ error: 'Profile not found.' });
  return res.json({ profile: data });
}

async function uploadRubrics(req, res) {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'files are required.' });
    let { courseId, instructorId } = req.body;
    if (!courseId || !instructorId) return res.status(400).json({ error: 'courseId and instructorId are required.' });
    
    courseId = await resolveCourseId(courseId);
    if (!courseId) return res.status(400).json({ error: 'Invalid Course ID or Join Code.' });

    const profile = await getOrCreateProfile(courseId, instructorId);

    // Save files locally — no Supabase Storage bucket required
    const uploadsDir = path.join(__dirname, '../../uploads/rubrics', courseId);
    const fs = require('fs');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const uploadedFiles = [];
    let completeText = '';

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
      const localPath = path.join(uploadsDir, fileName);
      const publicUrl = `/uploads/rubrics/${courseId}/${fileName}`;

      // Write to disk
      fs.writeFileSync(localPath, file.buffer);

      const { data, error } = await sb().from('ai_rubric_files').insert({
        profile_id: profile.id,
        course_id: courseId,
        file_name: file.originalname,
        storage_path: localPath,
        public_url: publicUrl,
      }).select().single();

      if (!error && data) uploadedFiles.push(data);

      // Extract text for AI rubric generation
      if (ext === '.pdf') {
        const pdfData = await pdfParse(file.buffer);
        completeText += '\n' + pdfData.text;
      } else {
        completeText += '\n' + file.buffer.toString('utf-8');
      }
    }

    // Auto-generate rubric JSON via Groq if text was extracted
    if (completeText.trim().length > 0) {
      const prompt = `You are an expert academic evaluator. Extract grading rubric from this text. Identify criteria like content, clarity, structure, etc. Assign marks logically. Ensure total = 100. Return ONLY JSON:
{
  "name": "Generated Rubric",
  "total_marks": 100,
  "criteria": [
    {
      "name": "",
      "description": "",
      "marks": number
    }
  ]
}
Text:
${completeText.substring(0, 6000)}`;

      try {
        const generatedJsonString = await generateText({ system: 'You return valid clean JSON only without markdown formatting.', prompt });
        const rawJsonString = generatedJsonString.replace(/```json/g, '').replace(/```/g, '').trim();
        const rubricJson = JSON.parse(rawJsonString);
        await sb().from('ai_training_profiles')
          .update({ rubric_json: rubricJson, updated_at: new Date().toISOString() })
          .eq('id', profile.id);
      } catch (parseErr) {
        console.warn('[training] Rubric JSON generation failed (non-fatal):', parseErr.message);
      }
    }

    return res.status(201).json({ rubrics: uploadedFiles, files: uploadedFiles });
  } catch (err) {
    console.error('[training] uploadRubrics error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed.' });
  }
}

async function addGoldSample(req, res) {
  try {
    let { courseId, instructorId, sampleType, studentAnswer, marks, feedback } = req.body;
    if (!courseId || !instructorId || !sampleType || marks === undefined)
      return res.status(400).json({ error: 'courseId, instructorId, sampleType, and marks are required.' });

    // Defaults for optional fields
    studentAnswer = (studentAnswer || '').trim() || `[${sampleType} sample — no answer text provided]`;
    feedback      = (feedback      || '').trim() || `${sampleType.charAt(0).toUpperCase() + sampleType.slice(1)}-quality answer.`;


    courseId = await resolveCourseId(courseId);
    if (!courseId) return res.status(400).json({ error: 'Invalid Course ID or Join Code.' });

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
  let { courseId } = req.params;
  courseId = await resolveCourseId(courseId);
  if (!courseId) return res.json({ samples: [] });

  const { data, error } = await sb().from('ai_gold_samples').select('*').eq('course_id', courseId).order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ samples: data || [] });
}

async function startTraining(req, res) {
  let { courseId } = req.body;
  if (!courseId) return res.status(400).json({ error: 'courseId required' });
  courseId = await resolveCourseId(courseId);
  if (!courseId) return res.status(400).json({ error: 'Invalid course code.' });
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
