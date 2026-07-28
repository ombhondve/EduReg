// ===== STUDENT PORTAL API CLIENT =====
// Mirrors the pattern in api-client.js / superadmin-api-client.js.
// This file only defines the calls the UI makes — every route here should
// be read-only on the backend and scoped to request.user's own student_id
// via the require_auth/require_role decorators. No student should ever be
// able to pass another student's id and get data back.
//
// Expected backend routes (all require role=student, scoped to self):
//   GET  /student/me                    -> own profile
//   GET  /student/me/courses            -> enrolled courses
//   GET  /student/me/grades             -> grade history
//   GET  /student/me/attendance         -> attendance summary
//   GET  /student/me/fees               -> fee/payment status
//   GET  /student/me/notices            -> notices/announcements
//   GET  /student/me/documents          -> own uploaded documents + verification status
//   POST /student/me/documents          -> upload a new document (multipart: file, docType)
//   GET  /student/me/messages           -> message thread with staff
//   POST /student/me/messages           -> send a message ({ body })
//   GET  /student/me/timetable          -> weekly class schedule
//   GET  /student/me/calendar           -> upcoming academic events/holidays/deadlines

const StudentPortalApi = {
  getProfile() {
    return requestApi('/student/me');
  },
  getCourses() {
    return requestApi('/student/me/courses');
  },
  getGrades() {
    return requestApi('/student/me/grades');
  },
  getAttendance() {
    return requestApi('/student/me/attendance');
  },
  getFees() {
    return requestApi('/student/me/fees');
  },
  getNotices() {
    return requestApi('/student/me/notices');
  },

  // Documents — this mirrors the staff-side DocumentsApi.getStudentDocuments,
  // just scoped to "me" instead of taking a studentId. A student can have
  // as many documents as they submit; each shows its own verification status.
  getDocuments() {
    return requestApi('/student/me/documents');
  },
  uploadDocument({ file, docType }) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('docType', docType);
    return requestApi('/student/me/documents', {
      method: 'POST',
      body: formData,
    });
  },

  // Messages — a simple thread between this student and institution staff.
  getMessages() {
    return requestApi('/student/me/messages');
  },
  sendMessage(body) {
    return requestApi('/student/me/messages', {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },

  // Timetable — this student's own weekly class schedule (derived from their course on the backend).
  getTimetable() {
    return requestApi('/student/me/timetable');
  },

  // Calendar — upcoming exams, holidays, deadlines, and events relevant to this student.
  getCalendarEvents() {
    return requestApi('/student/me/calendar');
  },
};
