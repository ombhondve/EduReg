// ===== ADMIN LOGIN / SIGNUP PAGE LOGIC =====
// Fully self-contained: does NOT load or depend on api-client.js / login.js.
// Talks only to POST /auth/admin_login and POST /auth/signup. Nothing here
// is shared with the student/college login page (login.html + login.js).

// If your Flask app serves this page itself (which controller.py does),
// leave this as '' so requests go to whatever host/port the page was
// loaded from. Only set window.ADMIN_API_BASE if the API truly lives on
// a different host, e.g. window.ADMIN_API_BASE = 'https://api.example.com'.
const API_BASE = window.ADMIN_API_BASE || '';

const ROLE_REDIRECTS = {
  super_admin: 'admin.html',
  admin: 'collage_portal.html',
  staff: 'collage_portal.html',
  student: 'student_portal.html',
};
const DEFAULT_REDIRECT = 'admin.html';
const AUTH_STORAGE_KEY = 'eduregUser';

function redirectForRole(user) {
  return ROLE_REDIRECTS[user?.role] || DEFAULT_REDIRECT;
}

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

// ---------- Tab switching ----------
function setAuthMode(mode) {
  const shell = document.getElementById('authShell');
  shell.dataset.mode = mode;

  document.getElementById('tabLogin').classList.toggle('active', mode === 'login');
  document.getElementById('tabSignup').classList.toggle('active', mode === 'signup');
  document.getElementById('loginForm').classList.toggle('active', mode === 'login');
  document.getElementById('signupForm').classList.toggle('active', mode === 'signup');

  const title = document.getElementById('authCardTitle');
  const sub = document.getElementById('authCardSub');
  const switchLine = document.getElementById('authSwitchLine');

  if (mode === 'login') {
    title.textContent = 'Welcome back';
    sub.textContent = 'Sign in to your registrar account';
    switchLine.innerHTML = `Don't have an account? <a class="auth-link" href="#" onclick="setAuthMode('signup');return false;">Create one</a>`;
  } else {
    title.textContent = 'Create your account';
    sub.textContent = 'Set up access to the registration portal';
    switchLine.innerHTML = `Already have an account? <a class="auth-link" href="#" onclick="setAuthMode('login');return false;">Log in</a>`;
  }
}

// ---------- Password visibility ----------
function togglePassword(fieldId, btn) {
  const input = document.getElementById(fieldId);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁️';
}

// ---------- Validation helpers ----------
function setFieldError(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message || '';
}
function isValidEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

// ---------- Login ----------
async function handleLogin(event) {
  event.preventDefault();
  setFieldError('liEmailErr', '');
  setFieldError('liPasswordErr', '');

  const email = document.getElementById('liEmail').value.trim();
  const password = document.getElementById('liPassword').value;

  let hasError = false;
  if (!email || !isValidEmail(email)) { setFieldError('liEmailErr', 'Enter a valid email'); hasError = true; }
  if (!password) { setFieldError('liPasswordErr', 'Enter your password'); hasError = true; }
  if (hasError) return false;

  const btn = document.getElementById('loginSubmitBtn');
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    const response = await fetch(`${API_BASE}/auth/admin_login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password ,role: "admin"}),
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : {};

    if (!response.ok) {
      throw new Error(data.error || 'Invalid email or password');
    }

    const user = { ...(data.user || data), accessToken: data.accessToken, refreshToken: data.refreshToken };
    setCurrentUser(user);
    showToast('Signed in successfully', 'success');
    setTimeout(() => { window.location.href = redirectForRole(user); }, 400);
  } catch (err) {
    console.error('Admin login request failed:', err);
    const message = err instanceof TypeError
      ? 'Could not reach the server. Check that the backend is running and reachable.'
      : (err.message || 'Invalid email or password');
    showToast(message, 'error');
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
  return false;
}

// ---------- Signup ----------
async function handleSignup(event) {
  event.preventDefault();
  setFieldError('suNameErr', '');
  setFieldError('suEmailErr', '');
  setFieldError('suPasswordErr', '');

  const name = document.getElementById('suName').value.trim();
  const email = document.getElementById('suEmail').value.trim();
  const password = document.getElementById('suPassword').value;
  const confirm = document.getElementById('suConfirm').value;

  let hasError = false;
  if (!name) { setFieldError('suNameErr', 'Enter your full name'); hasError = true; }
  if (!email || !isValidEmail(email)) { setFieldError('suEmailErr', 'Enter a valid email'); hasError = true; }
  if (!password || password.length < 6) { setFieldError('suPasswordErr', 'Password must be at least 6 characters'); hasError = true; }
  else if (password !== confirm) { setFieldError('suPasswordErr', 'Passwords do not match'); hasError = true; }
  if (hasError) return false;

  const btn = document.getElementById('signupSubmitBtn');
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Creating account…';

  try {
    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : {};

    if (!response.ok) {
      throw new Error(data.error || 'Could not create account');
    }

    const user = data && data.user ? data.user : data;
    if (user && (user.token || user.id)) {
      setCurrentUser(user);
      showToast('Account created', 'success');
      setTimeout(() => { window.location.href = redirectForRole(user); }, 400);
    } else {
      showToast('Account created — please log in', 'success');
      setAuthMode('login');
      document.getElementById('liEmail').value = email;
    }
  } catch (err) {
    console.error('Admin signup request failed:', err);
    const message = err instanceof TypeError
      ? 'Could not reach the server. Check that the backend is running and reachable.'
      : (err.message || 'Could not create account');
    showToast(message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
  return false;
}

// ---------- Toast ----------
function showToast(msg, type = 'info') {
  const cont = document.getElementById('toastContainer');
  if (!cont) return;
  const t = document.createElement('div');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  cont.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
}

// ---------- Ambient ledger (signature visual — decorative only) ----------
function buildLedger() {
  const track = document.getElementById('ledgerTrack');
  if (!track) return;
  const dotColors = ['#22c55e', '#f59e0b', '#3b82f6', '#e94560'];
  const rows = Array.from({ length: 14 }, () => {
    const w1 = 30 + Math.round(Math.random() * 40);
    const w2 = 20 + Math.round(Math.random() * 30);
    const color = dotColors[Math.floor(Math.random() * dotColors.length)];
    return `<div class="auth-ledger-row">
      <span class="auth-ledger-dot" style="background:${color}"></span>
      <span class="auth-ledger-bar" style="width:${w1}%"></span>
      <span class="auth-ledger-bar" style="width:${w2}%;opacity:.5"></span>
    </div>`;
  }).join('');
  track.innerHTML = rows + rows;
}

// ---------- Init ----------
(function initAuthPage() {
  buildLedger();
  const existing = getCurrentUser();
  if (existing) {
    window.location.href = redirectForRole(existing);
  }
})();
