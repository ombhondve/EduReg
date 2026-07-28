// ===== STUDENT PORTAL API CLIENT =====
// Mirrors the pattern in api-client.js / superadmin-api-client.js.
// This file only defines the calls the UI makes — every route here should
// be read-only on the backend and scoped to request.user's own student_id
// via the require_auth/require_role decorators. No student should ever be
// able to pass another student's id and get data back.
//
// Expected backend routes (all require role=student, scoped to self):
//   GET /student/me                    -> own profile
//   GET /student/me/courses            -> enrolled courses
//   GET /student/me/grades             -> grade history
//   GET /student/me/attendance         -> attendance summary
//   GET /student/me/fees               -> fee/payment status
//   GET /student/me/notices            -> notices/announcements

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
};
