// ===== EMPLOYEE ACCESS CONTROL =====
// Single source of truth for what each internal employee role can see (pages)
// and do (actions). superadmin.js reads this to hide nav items and to show/hide
// edit/delete/suspend/etc buttons. The Flask backend mirrors this same map
// (see api_permissions.py) and re-checks on every request — the frontend
// checks here are UX only, never trust them as the real security boundary.

const ROLE_PERMISSIONS = {
  super_admin: {
    pages: ['overview', 'employees', 'schools', 'students', 'onboarding', 'admins',
            'plans', 'revenue', 'tickets', 'implog', 'notifications', 'flags',
            'apimonitor', 'logs', 'settings'],
    actions: [
      'school.create', 'school.edit', 'school.delete', 'school.suspend', 'school.resendInvite',
      'employee.create', 'employee.edit', 'employee.delete', 'employee.suspend', 'employee.resendInvite',
      'ticket.update', 'impersonate', 'notification.send', 'flag.toggle', 'settings.edit',
    ],
  },
  support: {
    // Front-line: handles schools, students, onboarding, tickets — no billing,
    // no employee management, no platform config.
    pages: ['overview', 'schools', 'students', 'onboarding', 'admins', 'tickets', 'implog', 'logs', 'apimonitor'],
    actions: ['school.suspend', 'school.resendInvite', 'ticket.update', 'impersonate'],
  },
  billing: {
    // Owns plans/revenue and can suspend a school for non-payment, but can't
    // touch employees, tickets, or platform config.
    pages: ['overview', 'schools', 'plans', 'revenue', 'admins', 'logs'],
    actions: ['school.suspend', 'school.resendInvite'],
  },
  content: {
    // Owns broadcast messaging and feature flags only.
    pages: ['overview', 'notifications', 'flags', 'logs'],
    actions: ['notification.send', 'flag.toggle'],
  },
  read_only: {
    // Can see nearly everything for reporting/audit purposes, but never a
    // single mutating action, and no employees/settings pages at all.
    pages: ['overview', 'schools', 'students', 'onboarding', 'admins', 'plans',
            'revenue', 'tickets', 'implog', 'notifications', 'flags', 'apimonitor', 'logs'],
    actions: [],
  },
};

const DEFAULT_LANDING_PAGE = 'overview';

/** Reads the logged-in employee's access role(s). An employee can now hold
 *  more than one role (e.g. billing + content) — permissions are the UNION
 *  of every role they hold. If no role is set at all (e.g. this is the
 *  platform owner logging into their own panel, before your backend
 *  assigns per-employee roles), falls back to super_admin — full access —
 *  since that's who this panel belongs to by default. Once your backend
 *  starts sending a real role/roles for a specific invited employee, THAT
 *  takes over and restricts them normally. Always returns an array. */
function getCurrentEmployeeRoles() {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const raw = user && (user.roles || user.role); // roles: string[] preferred, role: string for old data
  const list = (Array.isArray(raw) ? raw : [raw]).filter(r => ROLE_PERMISSIONS[r]);
  return list.length ? list : ['super_admin'];
}

function canAccessPage(roles, page) {
  const list = Array.isArray(roles) ? roles : [roles];
  return list.some(r => ROLE_PERMISSIONS[r]?.pages.includes(page));
}

function canDo(roles, action) {
  const list = Array.isArray(roles) ? roles : [roles];
  return list.some(r => ROLE_PERMISSIONS[r]?.actions.includes(action));
}

/** All pages accessible to a set of roles, union'd and de-duplicated —
 *  used when picking a landing page for a multi-role employee. */
function accessiblePages(roles) {
  const list = Array.isArray(roles) ? roles : [roles];
  return [...new Set(list.flatMap(r => ROLE_PERMISSIONS[r]?.pages || []))];
}

/** All 15 sidebar pages, in nav order — used to render the per-page
 *  checkbox list in the Add/Edit Employee form. */
const ALL_PAGES = [
  { key: 'overview', label: 'Dashboard' },
  { key: 'employees', label: 'Employees' },
  { key: 'schools', label: 'Schools' },
  { key: 'students', label: 'Students' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'admins', label: 'School Admins' },
  { key: 'plans', label: 'Plans & Billing' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'tickets', label: 'Support Tickets' },
  { key: 'implog', label: 'Impersonation Log' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'flags', label: 'Feature Flags' },
  { key: 'apimonitor', label: 'API & Usage' },
  { key: 'logs', label: 'Activity Log' },
  { key: 'settings', label: 'Platform Settings' },
];

/** The pages an employee actually gets. If their record has an explicit
 *  `pages` list (set by ticking/unticking individual checkboxes in the
 *  Add Employee form) that WINS — it's the source of truth. Only employees
 *  with no explicit list at all (e.g. legacy data) fall back to whatever
 *  their roles would normally grant. */
function getCurrentEmployeePages() {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (user && Array.isArray(user.pages)) return user.pages;
  return accessiblePages(getCurrentEmployeeRoles());
}

/** Hides every nav item not in the employee's explicit page list. */
function applyNavPermissions(pages) {
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.style.display = pages.includes(el.dataset.page) ? '' : 'none';
  });
}
