// ===== LOGIN PAGE LOGIC =====
// Single login form; the "role" toggle (College/Staff vs Student) only
// changes the on-screen copy and is passed to the backend as a hint so it
// can validate the account actually matches that role. The backend's
// response still decides the final redirect via user.role.

const ROLE_REDIRECTS = {
  super_admin: 'admin.html',
  admin: 'collage_portal.html',
  staff: 'collage_portal.html',
  student: 'student_portal.html',
};
const DEFAULT_REDIRECT = 'admin.html';

// Copy shown per audience. Edit here to change wording without touching HTML.
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

// ---------- Role switching (College/Staff <-> Student) ----------
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
    // selectedRole is passed as a hint — AuthApi.login can ignore it if the
    // backend doesn't need it. The redirect always follows user.role from
    // the response, not the tab the person happened to click.
    const res = await AuthApi.login(email, password, selectedRole);
    const user = { ...(res.user || res), accessToken: res.accessToken, refreshToken: res.refreshToken };
    setCurrentUser(user);
    showToast('Signed in successfully', 'success');
    setTimeout(() => { window.location.href = redirectForRole(user); }, 400);
  } catch (err) {
    showToast(err.message || 'Invalid email or password', 'error');
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
  return false;
}

// ---------- Toast (standalone copy — this page doesn't load script.js) ----------
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
  // Duplicate the row set so the CSS translateY(-50%) loop is seamless
  track.innerHTML = rows + rows;
}

// ---------- Init ----------
(function initLoginPage() {
  buildLedger();
  setAuthRole('college'); // default view
  // If already signed in, skip straight to the right portal
  const existing = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (existing) {
    window.location.href = redirectForRole(existing);
  }
})();
