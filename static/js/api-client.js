// ===== API CLIENT =====
// This file is the only place you usually need to change when your backend
// REST API routes change.
//
// If your Flask API runs on the same app as the frontend, keep API_BASE as '/api'.
// If your API runs somewhere else, example: 'http://localhost:5000/api'
const API_BASE = window.API_BASE || 'http://127.0.0.1:5000';

async function requestApi(endpoint, options = {}, isRetry = false) {
  const user = getCurrentUser();
  const token = user?.accessToken;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      // Don't set Content-Type for FormData — the browser needs to add its
      // own multipart boundary, which it can only do if we leave this out.
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 401 && !isRetry && user?.refreshToken) {
    const refreshed = await tryRefresh(user.refreshToken);
    if (refreshed) return requestApi(endpoint, options, true);
  }

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    if (response.status === 401) { clearCurrentUser(); window.location.href = 'login.html'; }
    throw new Error(data?.error || 'Request failed');
  }
  return data;
}

async function tryRefresh(refreshToken) {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const { accessToken } = await res.json();
    const user = getCurrentUser();
    setCurrentUser({ ...user, accessToken });
    return true;
  } catch {
    return false;
  }
}


const StudentApi = {
  getStudents(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.course) params.set('course', filters.course);
    if (filters.status) params.set('status', filters.status);

    const query = params.toString();
    return requestApi(`/students${query ? `?${query}` : ''}`);
  },

  getStudent(studentId) {
    return requestApi(`/students/${studentId}`);
  },

  createStudent(studentData) {
    return requestApi('/students', {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
  },

  updateStudent(studentId, studentData) {
    return requestApi(`/students/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify(studentData),
    });
  },

  deleteStudent(studentId) {
    return requestApi(`/students/${studentId}`, {
      method: 'DELETE',
    });
  },

  getCourses() {
    return requestApi('/courses');
  },

  getStats() {
    return requestApi('/stats');
  },

  getAnalytics() {
    return requestApi('/analytics');
  },

  exportStudentsCsv() {
    window.location.href = `${API_BASE}/export/students.csv`;
  },
};

// ===== DOCUMENTS API =====
// A student can have MANY documents (ID proof, marksheets, TC, photo, and
// re-uploads after a rejection) — so this is modeled as its own resource
// with a one-to-many relationship to a student, not one field on the
// student record. Suggested backend shape (e.g. SQL):
//   documents(id, student_id, doc_type, file_name, file_path/storage_key,
//             mime_type, size_bytes, status, uploaded_at,
//             reviewed_by, reviewed_at, review_note)
//
// Expected routes:
//   GET    /students/:studentId/documents        -> Document[] for one student
//   GET    /documents?status=&type=&student=     -> Document[] across all students
//   POST   /students/:studentId/documents         (multipart/form-data: file, docType, status)
//                                                 -> created Document
//   PATCH  /documents/:documentId                 ({ status, reviewNote }) -> updated Document
//   DELETE /documents/:documentId
//   GET    /documents/:documentId/file            -> the raw stored file (view/download)
//
// Expected Document shape returned by the API:
//   { id, studentId, studentName, docType, fileName, fileUrl, mimeType,
//     sizeBytes, status, uploadedAt, reviewedBy, reviewedAt, reviewNote }
const DocumentsApi = {
  // All documents, optionally filtered — used by the Documents/Verification page.
  getDocuments(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.type) params.set('type', filters.type);
    if (filters.student) params.set('student', filters.student);
    const query = params.toString();
    return requestApi(`/documents${query ? `?${query}` : ''}`);
  },

  // Every document belonging to a single student (this is what makes
  // "12+ documents for one student" work: it's a list, not a single field).
  getStudentDocuments(studentId) {
    return requestApi(`/students/${studentId}/documents`);
  },

  // file: a File object from an <input type="file">.
  uploadDocument(studentId, { file, docType, status }) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('docType', docType);
    if (status) formData.append('status', status);
    return requestApi(`/students/${studentId}/documents`, {
      method: 'POST',
      body: formData,
    });
  },

  updateDocumentStatus(documentId, status, reviewNote = '') {
    return requestApi(`/documents/${documentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reviewNote }),
    });
  },

  deleteDocument(documentId) {
    return requestApi(`/documents/${documentId}`, {
      method: 'DELETE',
    });
  },

  // Not a JSON call — used as a direct href/target for viewing or
  // downloading the stored file (image/PDF/etc).
  getFileUrl(documentId) {
    return `${API_BASE}/documents/${documentId}/file`;
  },
};

const NotificationApi = {
  // filters: { type, audience, limit }
  getNotifications(filters = {}) {
    const params = new URLSearchParams();
    if (filters.type) params.set('type', filters.type);
    if (filters.audience) params.set('audience', filters.audience);
    if (filters.limit) params.set('limit', filters.limit);
    const query = params.toString();
    return requestApi(`/notifications${query ? `?${query}` : ''}`);
  },

  // payload: { title, message, type, audience: 'all'|'course'|'status'|'student', audienceValue, studentId }
  sendNotification(payload) {
    return requestApi('/notifications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteNotification(notificationId) {
    return requestApi(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  },

  resendNotification(notificationId) {
    return requestApi(`/notifications/${notificationId}/resend`, {
      method: 'POST',
    });
  },
};

// ===== AUTH API =====
// Point these at whatever routes your backend exposes for auth.
// Expected login/signup response shape: { id, name, email, role, token }
const AuthApi = {
  // Used by login.js (college/student login page)
  login(email, password, role) {
    return requestApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify(role ? { email, password, role } : { email, password }),
    });
  },

  // Used by auth.js (admin login page)
  adminLogin(email, password) {
    return requestApi('/auth/admin_login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  signup({ name, email, password }) {
    return requestApi('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },

  logout() {
    return requestApi('/auth/logout', { method: 'POST' });
  },
};

// ===== CURRENT USER (localStorage) =====
const AUTH_STORAGE_KEY = 'eduregUser';

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

function setCurrentUser(user) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

function clearCurrentUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}