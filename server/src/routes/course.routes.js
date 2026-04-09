const express = require('express');
const router = express.Router();
const { createCourse, listCourses, uploadCourseAsset, initializeCourse } = require('../controllers/course.controller');
const { upload } = require('../utils/upload');

router.get('/', listCourses);
router.post('/', createCourse);
router.post('/initialize', upload.array('files', 10), initializeCourse);
router.post('/upload-asset', upload.single('file'), uploadCourseAsset);

module.exports = router;
