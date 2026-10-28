const API_BASE = 'http://localhost:5000/api';

function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    ...getAuthHeader(),
    ...options.headers
  };

  // If body is FormData, do not set Content-Type header (browser sets boundary)
  if (!(options.body instanceof FormData) && options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // If token expired, clear auth
    // localStorage.removeItem('token');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  // Auth
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  getMe: () => request('/auth/me'),
  registerStudent: (studentData) => request('/auth/register-student', { method: 'POST', body: studentData }),
  forgotPassword: (identifier) => request('/auth/forgot-password', { method: 'POST', body: { identifier } }),
  resetPassword: (token, newPassword) => request('/auth/reset-password', { method: 'POST', body: { token, newPassword } }),

  // Student
  getStudentProfile: () => request('/student/profile'),
  getStudentTimetable: () => request('/student/timetable'),
  getStudentStats: () => request('/student/attendance-stats'),
  getActiveSessionForStudent: () => request('/student/active-session'),
  markAttendance: (formData) => request('/student/mark-attendance', { method: 'POST', body: formData }),

  // Teacher
  getTeacherOverview: () => request('/teacher/dashboard-overview'),
  getTeacherStudents: () => request('/teacher/students'),
  getTeacherClasses: () => request('/teacher/classes'),
  getTeacherSubjects: () => request('/teacher/subjects'),
  startSession: (sessionData) => request('/teacher/start-session', { method: 'POST', body: sessionData }),
  endSession: (sessionId) => request('/teacher/end-session', { method: 'POST', body: { sessionId } }),
  getSessionRoster: (sessionId) => request(`/teacher/session-roster/${sessionId}`),
  reviewSelfie: (recordId, decision, rejectionReason) => request('/teacher/review-selfie', { method: 'POST', body: { recordId, decision, rejectionReason } }),
  manualOverride: (sessionId, studentId, status, reason) => request('/teacher/manual-override', { method: 'POST', body: { sessionId, studentId, status, reason } }),

  // Admin
  getAdminOverview: () => request('/admin/overview'),
  getRules: () => request('/admin/rules'),
  updateRules: (rules) => request('/admin/rules', { method: 'PUT', body: rules }),
  getStudents: () => request('/admin/students'),
  getTeachers: () => request('/admin/teachers'),
  createTeacher: (teacherData) => request('/admin/teachers', { method: 'POST', body: teacherData }),
  getDepartments: () => request('/admin/departments'),
  getClasses: () => request('/admin/classes'),
  createClass: (classData) => request('/admin/classes', { method: 'POST', body: classData }),
  assignGFM: (classId, gfmTeacherId) => request(`/admin/classes/${classId}/gfm`, { method: 'PUT', body: { gfmTeacherId } }),
  getSubjects: () => request('/admin/subjects'),
  getTimetable: () => request('/admin/timetable'),
  createTimetableSlot: (slotData) => request('/admin/timetable', { method: 'POST', body: slotData }),
  getSubstitutions: () => request('/admin/substitutions'),
  createSubstitution: (data) => request('/admin/substitutions', { method: 'POST', body: data }),
  deleteSubstitution: (id) => request(`/admin/substitutions/${id}`, { method: 'DELETE' }),
  getPendingStudents: () => request('/admin/pending-students'),
  approveStudentEnrollment: (id, status, note) => request(`/admin/students/${id}/approve`, { method: 'PUT', body: { status, note } }),
  updateStudentProfile: (id, studentData) => request(`/admin/students/${id}`, { method: 'PUT', body: studentData }),
  adminResetPassword: (id, newPassword) => request(`/admin/users/${id}/reset-password`, { method: 'POST', body: { newPassword } }),

  // Telephony
  getProviderStatus: () => request('/telephony/provider-status'),
  getCallQueue: () => request('/telephony/call-queue'),
  syncLowAttendance: () => request('/telephony/sync-low-attendance', { method: 'POST' }),
  triggerCall: (queueId) => request('/telephony/trigger-call', { method: 'POST', body: { queueId } }),
  sendSms: (queueId, customMessage) => request('/telephony/send-sms', { method: 'POST', body: { queueId, customMessage } }),

  // Reports
  getClassSummary: (classId) => request(`/reports/class-summary/${classId}`),
  getAuditLogs: () => request('/reports/audit-logs'),
  getExportCsvUrl: (classId) => `${API_BASE}/reports/export-csv/${classId}`
};
