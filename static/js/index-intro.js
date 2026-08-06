// ===== SPLASH / INTRO REDIRECT =====
// Was previously an inline <script> block in index.html. Under a strict
// Content-Security-Policy (script-src 'self', no 'unsafe-inline'), inline
// <script> blocks are blocked just like inline onclick="" handlers — so
// that version silently never ran, and the splash screen never redirected
// anywhere. Moving it to an external, same-origin file fixes that.

var TARGET_LOGIN = 'login.html';
var ROLE_REDIRECTS = {
  super_admin: 'admin.html',
  admin: 'collage_portal.html',
  college_admin: 'collage_portal.html',
  staff: 'collage_portal.html',
  student: 'student_portal.html',
};
// No recognized role in storage (or nothing stored at all) -> login,
// not a portal. Landing an unauthenticated visitor on admin.html by
// default was the earlier bug: a blank/unknown role silently looked
// like a super admin.
var DEFAULT_REDIRECT = TARGET_LOGIN;

function goNext() {
  var user = null;
  try { user = JSON.parse(localStorage.getItem('eduregUser') || 'null'); } catch (e) {}
  if (!user) { window.location.href = TARGET_LOGIN; return; }
  window.location.href = ROLE_REDIRECTS[user.role] || DEFAULT_REDIRECT;
}

// Always play the intro animation, then redirect once it finishes.
setTimeout(goNext, 2750);
