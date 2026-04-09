const express = require('express');
const { upload } = require('../utils/upload');
const {
  uploadRubrics,
  uploadGoldSample,
  startTraining,
  getTrainingProfile,
  deleteRubric,
  deleteSample,
} = require('../controllers/training.controller');

const router = express.Router();

router.post('/rubrics/upload', upload.array('files', 20), uploadRubrics);
router.post('/samples/upload', upload.single('file'), uploadGoldSample);
router.post('/start', startTraining);
router.delete('/rubrics/:rubricId', deleteRubric);
router.delete('/samples/:sampleId', deleteSample);
router.get('/:courseId', getTrainingProfile);

module.exports = router;
