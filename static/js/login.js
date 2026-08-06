// ===== STUDENT / COLLEGE LOGIN PAGE LOGIC =====
// Fully self-contained: does NOT load or depend on api-client.js / auth.js.
// Talks only to POST /auth/login. Nothing here is shared with the admin
// login page (Ad_login.html + auth.js) on purpose.

// If your Flask app serves this page itself (which controller.py does),
// leave this as '' so requests go to whatever host/port the page was
// loaded from. Only set window.STUDENT_API_BASE if the API truly lives on
// a different host, e.g. window.STUDENT_API_BASE = 'https://api.example.com'.
const API_BASE = window.STUDENT_API_BASE || '';

const ROLE_REDIRECTS = {
  super_admin: 'admin.html',
  admin: 'collage_portal.html',
  college_admin: 'collage_portal.html',
  staff: 'collage_portal.html',
  student: 'student_portal.html',
};
// This page only ever logs in students or college admins, so an
// unrecognized role should never happen post-login — but if it does,
// send them to the college portal rather than guessing student.
const DEFAULT_REDIRECT = 'collage_portal.html';
const AUTH_STORAGE_KEY = 'eduregUser';

const ROLE_CONTENT = {
  college: {
    eyebrow: 'Registration Portal',
    headline: 'Every student record, <em>one intake away.</em>',
    sub: 'Sign in to manage registrations, track academic progress, and keep every course roster current.',
    step3: 'Manage Records',
    cardTitle: 'Welcome back',
    cardSub: 'Sign in to your registrar account',
    emailLabel: 'Email',
    emailPlaceholder: 'you@university.edu',
  },
  student: {
    eyebrow: 'Student Portal',
    headline: 'Your academic journey, <em>one login away.</em>',
    sub: 'Sign in to view your courses, track academic progress, and manage your registration.',
    step3: 'View Records',
    cardTitle: 'Welcome back',
    cardSub: 'Sign in to your student account',
    emailLabel: 'Email',
    emailPlaceholder: 'you@student.university.edu',
  },
};

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

function setAuthRole(role) {
  const shell = document.getElementById('authShell');
  shell.dataset.role = role;

  document.getElementById('tabCollege').classList.toggle('active', role === 'college');
  document.getElementById('tabStudent').classList.toggle('active', role === 'student');

  const c = ROLE_CONTENT[role] || ROLE_CONTENT.college;
  document.getElementById('brandEyebrow').textContent = c.eyebrow;
  document.getElementById('brandHeadline').innerHTML = c.headline;
  document.getElementById('brandSub').textContent = c.sub;
  document.getElementById('brandStep3').textContent = c.step3;
  document.getElementById('authCardTitle').textContent = c.cardTitle;
  document.getElementById('authCardSub').textContent = c.cardSub;

  const emailLabel = document.getElementById('liEmailLabel');
  const emailInput = document.getElementById('liEmail');
  if (emailLabel) emailLabel.textContent = c.emailLabel;
  if (emailInput) emailInput.placeholder = c.emailPlaceholder;
}

function togglePassword(fieldId, btn) {
  const input = document.getElementById(fieldId);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁️';
}

function setFieldError(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message || '';
}
function isValidEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

async function handleLogin(event) {
  event.preventDefault();
  setFieldError('liEmailErr', '');
  setFieldError('liPasswordErr', '');

  const email = document.getElementById('liEmail').value.trim();
  const password = document.getElementById('liPassword').value;
  const selectedRole = document.getElementById('authShell').dataset.role;

  let hasError = false;
  if (!email || !isValidEmail(email)) { setFieldError('liEmailErr', 'Enter a valid email'); hasError = true; }
  if (!password) { setFieldError('liPasswordErr', 'Enter your password'); hasError = true; }
  if (hasError) return false;

  const btn = document.getElementById('loginSubmitBtn');
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role: selectedRole }),
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
    console.error('Student/college login request failed:', err);
    const message = err instanceof TypeError
      ? 'Could not reach the server. Check that the backend is running and reachable.'
      : (err.message || 'Invalid email or password');
    showToast(message, 'error');
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
  return false;
}

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

(function initLoginPage() {
  buildLedger();
  setAuthRole('college');
  const existing = getCurrentUser();
  if (existing) {
    window.location.href = redirectForRole(existing);
    return;
  }

  // Wired here instead of onclick="" attributes in the HTML — inline
  // event handlers are blocked under a strict CSP (script-src 'self'
  // without 'unsafe-inline'), same as inline <script> blocks.
  document.getElementById('tabCollege').addEventListener('click', () => setAuthRole('college'));
  document.getElementById('tabStudent').addEventListener('click', () => setAuthRole('student'));
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  const pwToggle = document.getElementById('liPasswordToggle');
  if (pwToggle) pwToggle.addEventListener('click', () => togglePassword('liPassword', pwToggle));
  const forgotLink = document.getElementById('forgotPasswordLink');
  if (forgotLink) forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    showToast('Ask your admin to reset your password', 'info');
  });
})();
