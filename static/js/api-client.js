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

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
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
    if (response.status === 401) { clearCurrentUser(); window.location.href = 'login_signup.html'; }
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

// ===== AUTH API =====
// Point these at whatever routes your backend exposes for auth.
// Expected login/signup response shape: { id, name, email, role, token }
const AuthApi = {
  login(email, password) {
    return requestApi('/auth/login', {
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
