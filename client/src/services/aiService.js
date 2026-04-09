const API_BASE_URL = import.meta.env.VITE_AI_BACKEND_URL || 'http://localhost:8000/api';
const ROOT_API_URL = API_BASE_URL.replace(/\/api$/, '');

function buildNetworkError(error) {
  if (error instanceof TypeError) {
    return new Error('Cannot reach the backend server at http://localhost:8000. Start the server and try again.');
  }
  return error;
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

async function request(url, options) {
  try {
    const response = await fetch(url, options);
    return await parseResponse(response);
  } catch (error) {
    throw buildNetworkError(error);
  }
}

export const aiService = {
  async initializeCourse({ formData, files, currentUser }) {
    const payload = new FormData();
    payload.append('courseName', formData.courseName);
    payload.append('academicLevel', formData.academicLevel);
    payload.append('capacity', String(formData.capacity || 0));
    payload.append('instructorId', currentUser.uid);
    payload.append('instructorName', currentUser.displayName || currentUser.email?.split('@')[0] || 'Instructor');
    files.forEach((file) => payload.append('files', file));

    return request(`${API_BASE_URL}/courses/initialize`, {
      method: 'POST',
      body: payload,
    });
  },

  async fetchCourses({ instructorId, studentId }) {
    const qs = new URLSearchParams();
    if (instructorId) qs.set('instructorId', instructorId);
    if (studentId) qs.set('studentId', studentId);
    return request(`${API_BASE_URL}/courses?${qs.toString()}`);
  },

  async fetchCourseById(courseId) {
    return request(`${API_BASE_URL}/lms/courses/${courseId}`);
  },

  async joinCourse({ courseCode, studentId }) {
    return request(`${API_BASE_URL}/lms/courses/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseCode, studentId }),
    });
  },

  async fetchAnnouncements(courseId) {
    return request(`${API_BASE_URL}/lms/courses/${courseId}/announcements`);
  },

  async postAnnouncement(courseId, payload) {
    return request(`${API_BASE_URL}/lms/courses/${courseId}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async fetchAssignments(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.instructorId) qs.set('instructorId', filters.instructorId);
    if (filters.courseId) qs.set('courseId', filters.courseId);
    if (filters.studentId) qs.set('studentId', filters.studentId);
    return request(`${API_BASE_URL}/lms/assignments?${qs.toString()}`);
  },

  async createAssignment(payload) {
    return request(`${API_BASE_URL}/lms/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async uploadAssignmentAttachment(file) {
    const payload = new FormData();
    payload.append('file', file);
    return request(`${API_BASE_URL}/lms/assignments/upload`, {
      method: 'POST',
      body: payload,
    });
  },

  async createSubmission(payload) {
    return request(`${API_BASE_URL}/lms/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async uploadSubmissionFile(file) {
    const payload = new FormData();
    payload.append('file', file);
    return request(`${API_BASE_URL}/lms/submissions/upload`, {
      method: 'POST',
      body: payload,
    });
  },

  async fetchSubmissions(filters = {}) {
    const qs = new URLSearchParams();
    if (filters.studentId) qs.set('studentId', filters.studentId);
    if (filters.instructorId) qs.set('instructorId', filters.instructorId);
    if (filters.status) qs.set('status', filters.status);
    return request(`${API_BASE_URL}/lms/submissions?${qs.toString()}`);
  },

  async reviewSubmission(submissionId, payload) {
    return request(`${API_BASE_URL}/lms/submissions/${submissionId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async fetchGrades(studentId) {
    return request(`${API_BASE_URL}/lms/grades?studentId=${encodeURIComponent(studentId)}`);
  },

  async uploadRubrics({ courseId, instructorId, files }) {
    const payload = new FormData();
    payload.append('courseId', courseId);
    payload.append('instructorId', instructorId);
    files.forEach((file) => payload.append('files', file));

    return request(`${API_BASE_URL}/training/rubrics/upload`, {
      method: 'POST',
      body: payload,
    });
  },

  async uploadGoldSample({ courseId, instructorId, sampleType, studentAnswer, marks, feedback, file }) {
    const payload = new FormData();
    payload.append('courseId', courseId);
    payload.append('instructorId', instructorId);
    payload.append('sampleType', sampleType);
    payload.append('studentAnswer', studentAnswer || '');
    payload.append('marks', String(marks || 0));
    payload.append('feedback', feedback || '');
    if (file) payload.append('file', file);

    return request(`${API_BASE_URL}/training/samples/upload`, {
      method: 'POST',
      body: payload,
    });
  },

  async startTraining({ courseId, instructorId }) {
    return request(`${API_BASE_URL}/training/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, instructorId }),
    });
  },

  async getTrainingProfile(courseId) {
    return request(`${API_BASE_URL}/training/${courseId}`);
  },

  async deleteRubric(rubricId) {
    return request(`${API_BASE_URL}/training/rubrics/${rubricId}`, {
      method: 'DELETE',
    });
  },

  async deleteSample(sampleId) {
    return request(`${API_BASE_URL}/training/samples/${sampleId}`, {
      method: 'DELETE',
    });
  },

  async evaluateSubmission(payload) {
    return request(`${API_BASE_URL}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission: payload.textContent || payload.submission || '',
        assignmentPrompt: payload.assignmentPrompt || '',
        maxScore: payload.maxScore || 100,
        courseId: payload.courseId,
        instructorId: payload.instructorId,
        studentId: payload.studentId,
      }),
    });
  },

  async chatWithTutor(message, courseId, history = []) {
    const data = await request(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, courseId, history }),
    });
    return data.reply || data.response || 'Silence from the AI.';
  },

  async fetchNotifications(userId) {
    return request(`${API_BASE_URL}/notifications/${userId}`);
  },

  async markNotificationRead(notificationId) {
    return request(`${API_BASE_URL}/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  },

  resolveFileUrl(fileUrl) {
    if (!fileUrl) return '';
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) return fileUrl;
    if (fileUrl.startsWith('/uploads/')) return `${ROOT_API_URL}${fileUrl}`;
    return fileUrl;
  },
};
