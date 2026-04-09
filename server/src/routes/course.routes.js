const express = require('express');
const { upload } = require('../utils/upload');
const { initializeCourse, listCourses } = require('../controllers/course.controller');

const router = express.Router();

router.get('/', listCourses);
router.post('/initialize', upload.array('files', 20), initializeCourse);

module.exports = router;
