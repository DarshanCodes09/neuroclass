const express = require('express');
const { upload } = require('../utils/upload');
const {
  getProfile,
  uploadRubrics,
  addGoldSample,
  listGoldSamples,
  startTraining,
  deleteRubric,
  deleteSample
} = require('../controllers/training.controller');

const router = express.Router();

router.post('/rubrics/upload', upload.array('files', 20), uploadRubrics);
router.post('/samples/upload', upload.single('file'), addGoldSample);
router.get('/:courseId', getProfile);
router.get('/:courseId/samples', listGoldSamples);
router.post('/start', startTraining);
router.delete('/rubrics/:rubricId', deleteRubric);
router.delete('/samples/:sampleId', deleteSample);

module.exports = router;
