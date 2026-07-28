// ===== AUTH PAGE LOGIC =====
// Talks to /auth/login and /auth/signup (see AuthApi in api-client.js).
// On success, stores the returned user in localStorage via setCurrentUser()
// and redirects based on user.role.

const ROLE_REDIRECTS = {
  super_admin: 'super_admin.html',
  admin: 'student_registration_system.html',
  staff: 'student_registration_system.html',
  student: 'student_portal.html',
};
const DEFAULT_REDIRECT = 'student_registration_system.html';

function redirectForRole(user) {
  return ROLE_REDIRECTS[user?.role] || DEFAULT_REDIRECT;
}

// ---------- Tab switching ----------
function setAuthMode(mode){
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
function togglePassword(fieldId, btn){
  const input = document.getElementById(fieldId);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁️';
}

// ---------- Validation helpers ----------
function setFieldError(id, message){
  const el = document.getElementById(id);
  if (el) el.textContent = message || '';
}
function isValidEmail(email){
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

// ---------- Login ----------
async function handleLogin(event){
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
    const res = await AuthApi.login(email, password);
    // Backend returns { message, user: {...}, accessToken, refreshToken } — merge
    // the token fields onto the user object so getCurrentUser() carries everything.
    // user.role must be included by the backend for the redirect below to work.
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

// ---------- Signup ----------
async function handleSignup(event){
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
    const res = await AuthApi.signup({ name, email, password });
    const user = res && res.user ? res.user : res;
    if (user && (user.token || user.id)) {
      // Backend logged the user in immediately
      setCurrentUser(user);
      showToast('Account created', 'success');
      setTimeout(() => { window.location.href = redirectForRole(user); }, 400);
    } else {
      showToast('Account created — please log in', 'success');
      setAuthMode('login');
      document.getElementById('liEmail').value = email;
    }
  } catch (err) {
    showToast(err.message || 'Could not create account', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
  return false;
}

// ---------- Toast (standalone copy — this page doesn't load script.js) ----------
function showToast(msg, type = 'info'){
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
function buildLedger(){
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
(function initAuthPage(){
  buildLedger();
  // If already signed in, skip straight to the right portal
  const existing = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (existing) {
    window.location.href = redirectForRole(existing);
  }
})();
