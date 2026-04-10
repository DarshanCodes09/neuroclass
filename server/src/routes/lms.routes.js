const express = require('express');
const { upload } = require('../utils/upload');
const {
  getCourseById,
  joinCourse,
  listAnnouncements,
  postAnnouncement,
  listAssignments,
  createAssignment,
  uploadAssignmentAttachment,
  uploadSubmissionFile,
  createSubmission,
  listSubmissions,
  reviewSubmission,
  listGrades,
  deleteAssignment,
} = require('../controllers/lms.controller');

const router = express.Router();

router.get('/courses/:courseId', getCourseById);
router.post('/courses/join', joinCourse);
router.get('/courses/:courseId/announcements', listAnnouncements);
router.post('/courses/:courseId/announcements', postAnnouncement);

router.get('/assignments', listAssignments);
router.post('/assignments', createAssignment);
router.post('/assignments/upload', upload.single('file'), uploadAssignmentAttachment);
router.delete('/assignments/:assignmentId', deleteAssignment);

router.get('/submissions', listSubmissions);
router.post('/submissions', createSubmission);
router.post('/submissions/upload', upload.single('file'), uploadSubmissionFile);
router.patch('/submissions/:submissionId/review', reviewSubmission);

router.get('/grades', listGrades);

module.exports = router;
