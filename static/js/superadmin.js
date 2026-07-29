// ===== SUPER ADMIN UI LOGIC =====
// Renders pages and wires up modals. Talks to SuperAdminApi (superadmin-api-client.js).
// If a backend call fails (routes not implemented yet), falls back to DEMO_DATA
// so the UI is fully previewable before controller.py/model.py exist.
// Remove the DEMO_DATA fallbacks once your backend routes are live.

let currentPage = 'overview';
let pendingConfirmAction = null;
let pendingSchoolId = null;

const DEMO_DATA = {
  stats: {
    totalSchools: 14, activeSchools: 11, trialSchools: 2, suspendedSchools: 1,
    totalStudents: 8420, totalStaff: 312, mrr: 184000, newThisMonth: 3,
  },

  activityLog: [
    { type: 'create', text: 'Greenfield College onboarded on trial plan', time: '2 hours ago' },
    { type: 'suspend', text: 'Riverside Coaching Center suspended — payment overdue', time: '1 day ago' },
    { type: 'update', text: 'Sunrise Institute upgraded from Basic to Pro', time: '3 days ago' },
    { type: 'create', text: 'Northlake University onboarded on enterprise plan', time: '2 months ago' },
  ],

  // ---- Students (cross-tenant, read-only) ----
  students: [
    { id: 1, name: 'Aarav Patil', rollNo: '21CS0147', schoolId: 1, schoolName: 'Sunrise Institute of Technology', program: 'B.Tech CSE, Sem 5', status: 'Active', lastActive: '2 hours ago', enrolled: 'Aug 2023', email: 'aarav.patil@sunrise.edu' },
    { id: 2, name: 'Sneha Kulkarni', rollNo: '21ME0089', schoolId: 3, schoolName: 'Northlake University', program: 'B.Tech Mech, Sem 3', status: 'Active', lastActive: 'Yesterday', enrolled: 'Jan 2024', email: 'sneha.k@northlake.edu' },
    { id: 3, name: 'Rohan Mehta', rollNo: '24DP0212', schoolId: 2, schoolName: 'Greenfield College', program: 'Diploma EE, Sem 1', status: 'Flagged', lastActive: '5 days ago', enrolled: 'Jun 2026', email: 'rohan.m@greenfield.edu' },
    { id: 4, name: 'Tanvi Joshi', rollNo: '22CE0034', schoolId: 4, schoolName: 'Riverside Coaching Center', program: 'Civil, Sem 7', status: 'Inactive', lastActive: '32 days ago', enrolled: 'Jul 2022', email: 'tanvi.j@riverside.edu' },
  ],

  // ---- Onboarding pipeline (stage extends school status) ----
  onboardingStages: ['Invited', 'Setup', 'Verifying', 'Active'],
  onboardingSchools: [
    { id: 5, name: 'Horizon Coaching Institute', city: 'Indore', stage: 'Invited', updatedAgo: '1 day ago' },
    { id: 6, name: 'Vidya Bhavan Polytechnic', city: 'Surat', stage: 'Setup', updatedAgo: '3 hours ago' },
    { id: 2, name: 'Greenfield College', city: 'Pune', stage: 'Verifying', updatedAgo: '2 hours ago' },
    { id: 1, name: 'Sunrise Institute of Technology', city: 'Nashik', stage: 'Active', updatedAgo: '5 months ago' },
    { id: 3, name: 'Northlake University', city: 'Bengaluru', stage: 'Active', updatedAgo: '8 months ago' },
  ],

  // ---- Revenue ----
  revenue: {
    mrr: 184000, mrrGrowthPct: 8.4, renewalsDueThisMonth: 5, churnedThisMonth: 1,
    byPlan: [
      { plan: 'Trial', amount: 0, schools: 2 },
      { plan: 'Basic', amount: 24995, schools: 5 },
      { plan: 'Pro', amount: 90993, schools: 7 },
      { plan: 'Enterprise', amount: 68000, schools: 2 },
    ],
  },

  // ---- Support tickets ----
  tickets: [
    { id: 101, subject: 'Unable to bulk-import student roster (CSV rejected)', schoolName: 'Vidya Bhavan Polytechnic', priority: 'high', status: 'open', updatedAgo: '20 minutes ago' },
    { id: 102, subject: 'Billing shows Pro plan but invoice still says Basic', schoolName: 'Sunrise Institute of Technology', priority: 'medium', status: 'pending', updatedAgo: '3 hours ago' },
    { id: 103, subject: 'Request to increase max staff seats', schoolName: 'Northlake University', priority: 'low', status: 'pending', updatedAgo: '1 day ago' },
    { id: 104, subject: 'Subdomain SSL certificate showing as expired', schoolName: 'Riverside Coaching Center', priority: 'high', status: 'resolved', updatedAgo: '2 days ago' },
  ],

  // ---- Impersonation audit log ----
  impersonationLog: [
    { admin: 'You', schoolName: 'Vidya Bhavan Polytechnic', reason: 'Debug CSV import failure', time: '18 minutes ago' },
    { admin: 'You', schoolName: 'Sunrise Institute of Technology', reason: 'Verify billing plan mismatch', time: '2 hours ago' },
  ],

  // ---- Notifications / broadcasts ----
  notifications: [
    { title: 'Scheduled maintenance — July 30, 1–2 AM IST', audience: 'All schools', sentAgo: '2 days ago' },
    { title: 'New certificate module now available on Pro plan', audience: 'Pro & Enterprise', sentAgo: '1 week ago' },
  ],

  // ---- Feature flags ----
  featureFlags: [
    { key: 'exam_engine', name: 'Online Exam Engine', desc: 'Timed exams, auto-grading, question banks', enabled: true, scope: 'All plans' },
    { key: 'certificates', name: 'Certificate Generator', desc: 'Auto-generate signed completion certificates', enabled: true, scope: 'Pro & Enterprise' },
    { key: 'fee_module', name: 'Fee Management', desc: 'Fee structures, receipts, payment reminders', enabled: false, scope: 'Enterprise only' },
    { key: 'alumni_network', name: 'Alumni Network', desc: 'Alumni directory and engagement tools', enabled: false, scope: 'Beta — invite only' },
  ],

  // ---- API & usage monitor ----
  apiUsage: [
    { schoolName: 'Sunrise Institute of Technology', apiCallsToday: 4820, storagePct: 62, rateLimitHits: 0 },
    { schoolName: 'Northlake University', apiCallsToday: 18340, storagePct: 41, rateLimitHits: 0 },
    { schoolName: 'Greenfield College', apiCallsToday: 980, storagePct: 78, rateLimitHits: 3 },
    { schoolName: 'Riverside Coaching Center', apiCallsToday: 120, storagePct: 95, rateLimitHits: 12 },
  ],
};

async function apiOrDemo(apiCall, demoValue) {
  try {
    return await apiCall();
  } catch (e) {
    return demoValue;
  }
}

// ===== Performance helpers =====
// 1) Short-lived response cache so switching between nav pages (or re-opening
//    the same page) doesn't refire the same network request every time.
//    Real-time pages (tickets, activity log) use a shorter TTL; mostly-static
//    pages (plans, flags) use a longer one.
const _apiCache = new Map(); // key -> { value, expiresAt }
const CACHE_TTL_DEFAULT = 30_000;

async function cachedApiOrDemo(cacheKey, apiCall, demoValue, ttlMs = CACHE_TTL_DEFAULT) {
  const hit = _apiCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await apiOrDemo(apiCall, demoValue);
  _apiCache.set(cacheKey, { value, expiresAt: Date.now() + ttlMs });
  return value;
}
function invalidateCache(prefix) {
  for (const key of _apiCache.keys()) {
    if (!prefix || key.startsWith(prefix)) _apiCache.delete(key);
  }
}

// 2) Debounce — used on free-text search inputs so filtering (and any future
//    server-side search call) doesn't run on every keystroke.
function debounce(fn, delay = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// 3) Client-side pagination — renders one page of rows at a time instead of
//    the full array, so large tables (students, logs) don't bloat the DOM.
function paginate(rows, page, perPage) {
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const start = (clampedPage - 1) * perPage;
  return { pageRows: rows.slice(start, start + perPage), page: clampedPage, totalPages, total: rows.length };
}
function paginationHtml(page, totalPages, total, onGoto) {
  if (totalPages <= 1) return '';
  return `<div class="pagination">
    <span>${total} total</span>
    <div class="pagination-controls">
      <button class="pagination-btn" ${page <= 1 ? 'disabled' : ''} onclick="${onGoto}(${page - 1})">Prev</button>
      <span class="pagination-btn active">${page} / ${totalPages}</span>
      <button class="pagination-btn" ${page >= totalPages ? 'disabled' : ''} onclick="${onGoto}(${page + 1})">Next</button>
    </div>
  </div>`;
}

function navigateSA(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  const titles = {
    overview: ['Platform overview', 'All schools on EduReg'],
    schools: ['Schools', 'Manage tenant institutions'],
    students: ['Students', "Cross-school directory, synced from each college's staff dashboard"],
    onboarding: ['Onboarding pipeline', 'Schools moving from invite to fully active'],
    admins: ['School admins', 'Primary contacts across all schools'],
    plans: ['Plans & billing', 'Subscription tiers and revenue'],
    revenue: ['Revenue', 'MRR, plan mix, and renewals'],
    tickets: ['Support tickets', 'Issues raised by school admins'],
    implog: ['Impersonation log', 'Audit trail of "View as School Admin" sessions'],
    notifications: ['Notifications', 'Broadcast announcements to school admins'],
    flags: ['Feature flags', 'Control which modules each plan or school can access'],
    apimonitor: ['API & usage monitor', 'Per-school API volume, storage, and rate limits'],
    logs: ['Activity log', 'Platform-wide actions'],
    settings: ['Platform settings', 'Global configuration'],
  };
  document.getElementById('saPageTitle').textContent = titles[page][0];
  document.getElementById('saPageSubtitle').textContent = titles[page][1];
  document.getElementById('saTopbarActions').style.display = (page === 'schools' || page === 'overview') ? 'flex' : 'none';
  renderPage(page);
}

async function renderPage(page) {
  const el = document.getElementById('saMainContent');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
  if (page === 'overview') return renderOverview();
  if (page === 'schools') return renderSchools();
  if (page === 'students') return renderStudents();
  if (page === 'onboarding') return renderOnboarding();
  if (page === 'admins') return renderAdmins();
  if (page === 'plans') return renderPlans();
  if (page === 'revenue') return renderRevenue();
  if (page === 'tickets') return renderTickets();
  if (page === 'implog') return renderImpersonationLog();
  if (page === 'notifications') return renderNotifications();
  if (page === 'flags') return renderFeatureFlags();
  if (page === 'apimonitor') return renderApiMonitor();
  if (page === 'logs') return renderLogs();
  if (page === 'settings') return renderSettings();
}

async function renderOverview() {
  const stats = await cachedApiOrDemo('stats', () => SuperAdminApi.getStats(), DEMO_DATA.stats);
  const schools = await cachedApiOrDemo('schools', () => SuperAdminApi.getSchools(), DEMO_DATA.schools);
  const el = document.getElementById('saMainContent');
  el.innerHTML = `
    <div class="sa-stats-grid fade-in">
      <div class="sa-stat-card">
        <div class="sa-stat-top"><span class="sa-stat-label">Total schools</span></div>
        <div class="sa-stat-value">${stats.totalSchools}</div>
        <div class="sa-stat-sub up">+${stats.newThisMonth} this month</div>
      </div>
      <div class="sa-stat-card">
        <div class="sa-stat-top"><span class="sa-stat-label">Total students</span></div>
        <div class="sa-stat-value">${stats.totalStudents.toLocaleString()}</div>
        <div class="sa-stat-sub">Across all schools</div>
      </div>
      <div class="sa-stat-card">
        <div class="sa-stat-top"><span class="sa-stat-label">Total staff</span></div>
        <div class="sa-stat-value">${stats.totalStaff}</div>
        <div class="sa-stat-sub">Across all schools</div>
      </div>
      <div class="sa-stat-card">
        <div class="sa-stat-top"><span class="sa-stat-label">Monthly revenue</span></div>
        <div class="sa-stat-value">₹${stats.mrr.toLocaleString()}</div>
        <div class="sa-stat-sub ${stats.suspendedSchools ? 'warn' : 'up'}">${stats.suspendedSchools} suspended</div>
      </div>
    </div>
    <div class="card fade-in">
      <div class="card-header">
        <span class="card-title">Recently onboarded schools</span>
        <button class="btn btn-secondary btn-sm" onclick="navigateSA('schools')">View all</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>School</th><th>Plan</th><th>Students</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>${schools.slice(0, 5).map(schoolRow).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

async function renderSchools(preserveFilters) {
  const planVal = preserveFilters ? document.getElementById('planFilter')?.value : '';
  const statusVal = preserveFilters ? document.getElementById('statusFilter')?.value : '';
  const searchVal = preserveFilters ? document.getElementById('schoolSearchInput')?.value : '';
  const schools = await cachedApiOrDemo(
    'schools',
    () => SuperAdminApi.getSchools({ plan: planVal, status: statusVal, search: searchVal }),
    DEMO_DATA.schools
  );
  window._allSchools = schools;
  const filtered = applySchoolFilters(schools, searchVal, planVal, statusVal);
  const el = document.getElementById('saMainContent');
  el.innerHTML = `
    <div class="toolbar fade-in">
      <div class="search-box">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="schoolSearchInput" placeholder="Search schools..." value="${searchVal || ''}" oninput="filterSchools()">
      </div>
      <select id="planFilter" onchange="filterSchools()">
        <option value="">All plans</option>
        <option value="trial" ${planVal === 'trial' ? 'selected' : ''}>Trial</option>
        <option value="basic" ${planVal === 'basic' ? 'selected' : ''}>Basic</option>
        <option value="pro" ${planVal === 'pro' ? 'selected' : ''}>Pro</option>
        <option value="enterprise" ${planVal === 'enterprise' ? 'selected' : ''}>Enterprise</option>
      </select>
      <select id="statusFilter" onchange="filterSchools()">
        <option value="">All status</option>
        <option ${statusVal === 'Active' ? 'selected' : ''}>Active</option>
        <option ${statusVal === 'Trial' ? 'selected' : ''}>Trial</option>
        <option ${statusVal === 'Suspended' ? 'selected' : ''}>Suspended</option>
      </select>
    </div>
    <div class="card fade-in">
      <div class="table-wrap">
        <table>
          <thead><tr><th>School</th><th>Admin contact</th><th>Plan</th><th>Usage</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody id="schoolsTbody">${renderSchoolRowsOrEmpty(filtered)}</tbody>
        </table>
      </div>
    </div>`;
}

function applySchoolFilters(schools, search, plan, status) {
  return schools.filter(s => {
    const matchesSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.subdomain.toLowerCase().includes(search.toLowerCase());
    const matchesPlan = !plan || s.plan === plan;
    const matchesStatus = !status || s.status === status;
    return matchesSearch && matchesPlan && matchesStatus;
  });
}

function renderSchoolRowsOrEmpty(rows) {
  if (!rows.length) {
    return `<tr><td colspan="7"><div class="empty-state">
      <div class="empty-icon">🏫</div>
      <div class="empty-title">No schools match these filters</div>
      <div style="font-size:0.82rem">Try clearing the search or filters, or add a new school.</div>
    </div></td></tr>`;
  }
  return rows.map(schoolRow).join('');
}

function schoolRow(s) {
  const usagePct = Math.round((s.students / s.maxStudents) * 100);
  const usageClass = usagePct >= 95 ? 'full' : usagePct >= 75 ? 'warn' : 'ok';
  const initials = s.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return `<tr>
    <td><div class="school-info">
      <div class="school-avatar">${initials}</div>
      <div><div class="school-name">${s.name}</div><div class="school-sub">${s.subdomain}.edureg.app · ${s.city}</div></div>
    </div></td>
    <td><div class="school-name" style="font-weight:400">${s.adminName}</div><div class="school-sub">${s.adminEmail}</div></td>
    <td><span class="plan-badge plan-${s.plan}">${s.plan}</span></td>
    <td><div class="sa-usage">
      <div class="sa-usage-track"><div class="sa-usage-fill ${usageClass}" style="width:${usagePct}%"></div></div>
      <span class="sa-usage-text">${s.students}/${s.maxStudents}</span>
    </div></td>
    <td><span class="status status-${s.status.toLowerCase()}"><span class="status-dot"></span>${s.status}</span></td>
    <td style="color:var(--text3);font-size:0.8rem">${s.createdAt}</td>
    <td>
      <button class="btn-icon" title="View" onclick="viewSchool(${s.id})">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      ${s.status === 'Suspended'
        ? `<button class="btn-icon" title="Activate" onclick="askConfirmSA(${s.id},'activate')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>`
        : `<button class="btn-icon" title="Suspend" onclick="askConfirmSA(${s.id},'suspend')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/></svg></button>`}
    </td>
  </tr>`;
}

function filterSchools() {
  const search = document.getElementById('schoolSearchInput')?.value || '';
  const plan = document.getElementById('planFilter')?.value || '';
  const status = document.getElementById('statusFilter')?.value || '';
  const filtered = applySchoolFilters(window._allSchools || [], search, plan, status);
  document.getElementById('schoolsTbody').innerHTML = renderSchoolRowsOrEmpty(filtered);
}

// ================= Students (cross-tenant, read-only) =================
const STUDENTS_PER_PAGE = 10;
let _studentsPage = 1;
const debouncedFilterStudents = debounce(() => { _studentsPage = 1; renderStudentsTable(); }, 200);

async function renderStudents() {
  const students = await cachedApiOrDemo('students', () => SuperAdminApi.getStudents(), DEMO_DATA.students);
  const schools = await cachedApiOrDemo('schools', () => SuperAdminApi.getSchools(), DEMO_DATA.schools);
  window._allStudents = students;
  window._allSchoolsForStudents = schools;
  _studentsPage = 1;
  const el = document.getElementById('saMainContent');
  const flagged = students.filter(s => s.status === 'Flagged').length;
  const active = students.filter(s => s.status === 'Active').length;
  el.innerHTML = `
    <div class="sa-stats-grid fade-in">
      <div class="sa-stat-card"><div class="sa-stat-top"><span class="sa-stat-label">Total students</span></div><div class="sa-stat-value">${students.length.toLocaleString()}</div><div class="sa-stat-sub">across ${schools.length} schools</div></div>
      <div class="sa-stat-card"><div class="sa-stat-top"><span class="sa-stat-label">Active</span></div><div class="sa-stat-value">${active.toLocaleString()}</div><div class="sa-stat-sub up">${students.length ? Math.round(active / students.length * 100) : 0}% of total</div></div>
      <div class="sa-stat-card"><div class="sa-stat-top"><span class="sa-stat-label">In trial schools</span></div><div class="sa-stat-value">${schools.filter(s => s.plan === 'trial').reduce((sum, s) => sum + (s.students || 0), 0).toLocaleString()}</div><div class="sa-stat-sub">${schools.filter(s => s.plan === 'trial').length} schools on trial</div></div>
      <div class="sa-stat-card"><div class="sa-stat-top"><span class="sa-stat-label">Flagged records</span></div><div class="sa-stat-value">${flagged}</div><div class="sa-stat-sub ${flagged ? 'warn' : ''}">duplicate ID or missing docs</div></div>
    </div>
    <div class="toolbar fade-in">
      <div class="search-box">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="studentSearchInput" placeholder="Search by name, roll no., or email..." oninput="debouncedFilterStudents()">
      </div>
      <select id="studentSchoolFilter" onchange="filterStudentsNow()">
        <option value="">All schools</option>
        ${schools.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
      </select>
      <select id="studentStatusFilter" onchange="filterStudentsNow()">
        <option value="">All statuses</option>
        <option>Active</option><option>Inactive</option><option>Flagged</option>
      </select>
    </div>
    <div class="card fade-in">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Student</th><th>School</th><th>Program</th><th>Status</th><th>Last active</th><th>Enrolled</th></tr></thead>
          <tbody id="studentsTbody"></tbody>
        </table>
      </div>
      <div id="studentsPagination"></div>
    </div>`;
  renderStudentsTable();
}

function filterStudentsNow() { _studentsPage = 1; renderStudentsTable(); }

function applyStudentFilters(students) {
  const search = (document.getElementById('studentSearchInput')?.value || '').toLowerCase();
  const schoolId = document.getElementById('studentSchoolFilter')?.value || '';
  const status = document.getElementById('studentStatusFilter')?.value || '';
  return students.filter(s => {
    const matchesSearch = !search || s.name.toLowerCase().includes(search) || s.rollNo.toLowerCase().includes(search) || s.email.toLowerCase().includes(search);
    const matchesSchool = !schoolId || String(s.schoolId) === String(schoolId);
    const matchesStatus = !status || s.status === status;
    return matchesSearch && matchesSchool && matchesStatus;
  });
}

function renderStudentsTable() {
  const filtered = applyStudentFilters(window._allStudents || []);
  const { pageRows, page, totalPages, total } = paginate(filtered, _studentsPage, STUDENTS_PER_PAGE);
  const tbody = document.getElementById('studentsTbody');
  if (!tbody) return;
  tbody.innerHTML = pageRows.length ? pageRows.map(studentRow).join('') : `<tr><td colspan="6"><div class="empty-state">
      <div class="empty-icon">🎓</div>
      <div class="empty-title">No students match these filters</div>
      <div style="font-size:0.82rem">Try clearing the search or filters.</div>
    </div></td></tr>`;
  document.getElementById('studentsPagination').innerHTML = paginationHtml(page, totalPages, total, 'gotoStudentsPage');
}
function gotoStudentsPage(p) { _studentsPage = p; renderStudentsTable(); }

function studentRow(s) {
  const initials = s.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const statusClass = s.status === 'Active' ? 'status-active' : s.status === 'Flagged' ? 'status-suspended' : 'status-pending';
  return `<tr class="row" onclick="viewStudent(${s.id})" style="cursor:pointer">
    <td><div class="student-info"><div class="student-avatar">${initials}</div><div><div class="student-name">${s.name}</div><div class="student-sub">Roll No. ${s.rollNo}</div></div></div></td>
    <td><span class="school-tag">${s.schoolName}</span></td>
    <td>${s.program}</td>
    <td><span class="status ${statusClass}"><span class="status-dot"></span>${s.status}</span></td>
    <td style="color:var(--text3);font-size:0.8rem">${s.lastActive}</td>
    <td style="color:var(--text3);font-size:0.8rem">${s.enrolled}</td>
  </tr>`;
}

function viewStudent(id) {
  const s = (window._allStudents || DEMO_DATA.students).find(x => x.id === id);
  if (!s) return;
  document.getElementById('entityDetailTitle').textContent = s.name;
  document.getElementById('entityDetailBody').innerHTML = `
    <div class="sa-invite-note" style="margin:0 0 1rem">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      This record is owned by the school's staff dashboard. Use "View as School Admin" to make changes.
    </div>
    <div class="sa-detail-grid">
      <div class="sa-detail-block">
        <div class="sa-detail-block-title">Student</div>
        <div class="sa-detail-row"><span>Roll No.</span><span>${s.rollNo}</span></div>
        <div class="sa-detail-row"><span>Program</span><span>${s.program}</span></div>
        <div class="sa-detail-row"><span>Email</span><span>${s.email}</span></div>
        <div class="sa-detail-row"><span>Status</span><span>${s.status}</span></div>
      </div>
      <div class="sa-detail-block">
        <div class="sa-detail-block-title">School</div>
        <div class="sa-detail-row"><span>Institution</span><span>${s.schoolName}</span></div>
        <div class="sa-detail-row"><span>Enrolled</span><span>${s.enrolled}</span></div>
        <div class="sa-detail-row"><span>Last active</span><span>${s.lastActive}</span></div>
      </div>
      <div class="sa-detail-block" style="grid-column:1/-1;display:flex;gap:10px">
        <button class="btn btn-secondary" style="flex:1" onclick="impersonateSchool(${s.schoolId},'${s.schoolName.replace(/'/g, "\\'")}')">View as School Admin</button>
        <button class="btn btn-primary" style="flex:1" onclick="closeOverlaySA('entityDetailModal')">Open in School Dashboard</button>
      </div>
    </div>`;
  document.getElementById('entityDetailModal').classList.add('show');
  document.getElementById('entityDetailModal').style.display = 'flex';
}

async function impersonateSchool(schoolId, schoolName) {
  try {
    await SuperAdminApi.impersonateSchoolAdmin(schoolId);
    showToastSA(`Impersonation session started for ${schoolName} — logged to Impersonation Log`, 'info');
  } catch (e) {
    showToastSA('Connect backend to start an impersonation session', 'info');
  }
  invalidateCache('implog');
  closeOverlaySA('entityDetailModal');
}

// ================= Onboarding pipeline =================
async function renderOnboarding() {
  const schools = await cachedApiOrDemo('onboarding', () => SuperAdminApi.getOnboardingPipeline(), DEMO_DATA.onboardingSchools);
  const stages = DEMO_DATA.onboardingStages;
  const el = document.getElementById('saMainContent');
  el.innerHTML = `<div class="kanban fade-in">
    ${stages.map(stage => {
      const inStage = schools.filter(s => s.stage === stage);
      return `<div class="kanban-col">
        <div class="kanban-col-head"><span>${stage}</span><span class="kanban-count">${inStage.length}</span></div>
        ${inStage.map(s => `<div class="kanban-card" onclick="viewSchool(${s.id})">
          <div class="kanban-card-name">${s.name}</div>
          <div class="kanban-card-sub">${s.city} · updated ${s.updatedAgo}</div>
        </div>`).join('') || '<div class="kanban-card-sub" style="padding:6px 2px">Nothing here</div>'}
      </div>`;
    }).join('')}
  </div>`;
}

async function renderAdmins() {
  const schools = await cachedApiOrDemo('schools', () => SuperAdminApi.getSchools(), DEMO_DATA.schools);
  const el = document.getElementById('saMainContent');
  const rowsHtml = schools.length ? schools.map(s => `<tr>
      <td><div class="school-name">${s.adminName}</div></td>
      <td>${s.name}</td>
      <td style="color:var(--text3)">${s.adminEmail}</td>
      <td><span class="status status-active"><span class="status-dot"></span>Accepted</span></td>
      <td><button class="btn btn-secondary btn-sm" onclick="resendInvite(${s.id})">Resend invite</button></td>
    </tr>`).join('')
    : `<tr><td colspan="5"><div class="empty-state">
        <div class="empty-icon">👤</div>
        <div class="empty-title">No school admins yet</div>
        <div style="font-size:0.82rem">Admins appear here once you onboard a school.</div>
      </div></td></tr>`;
  el.innerHTML = `<div class="card fade-in"><div class="table-wrap"><table>
    <thead><tr><th>Admin</th><th>School</th><th>Email</th><th>Invite status</th><th></th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table></div></div>`;
}

async function renderPlans() {
  const stats = await cachedApiOrDemo('stats', () => SuperAdminApi.getStats(), DEMO_DATA.stats);
  const el = document.getElementById('saMainContent');
  const plans = [
    { key: 'trial', label: 'Trial', price: '₹0', desc: '14-day evaluation', count: stats.trialSchools },
    { key: 'basic', label: 'Basic', price: '₹4,999/mo', desc: 'Up to 200 students', count: DEMO_DATA.schools.filter(s => s.plan === 'basic').length },
    { key: 'pro', label: 'Pro', price: '₹12,999/mo', desc: 'Up to 1,000 students', count: DEMO_DATA.schools.filter(s => s.plan === 'pro').length },
    { key: 'enterprise', label: 'Enterprise', price: 'Custom', desc: 'Unlimited, dedicated support', count: DEMO_DATA.schools.filter(s => s.plan === 'enterprise').length },
  ];
  el.innerHTML = `<div class="sa-stats-grid fade-in">${plans.map(p => `
    <div class="sa-stat-card">
      <div class="sa-stat-top"><span class="plan-badge plan-${p.key}">${p.label}</span></div>
      <div class="sa-stat-value">${p.price}</div>
      <div class="sa-stat-sub">${p.desc} · ${p.count} schools</div>
    </div>`).join('')}</div>`;
}

// ================= Revenue =================
async function renderRevenue() {
  const rev = await cachedApiOrDemo('revenue', () => SuperAdminApi.getRevenue(), DEMO_DATA.revenue);
  const el = document.getElementById('saMainContent');
  const maxAmount = Math.max(...rev.byPlan.map(p => p.amount), 1);
  el.innerHTML = `
    <div class="sa-stats-grid fade-in">
      <div class="sa-stat-card"><div class="sa-stat-top"><span class="sa-stat-label">Monthly recurring revenue</span></div><div class="sa-stat-value">₹${rev.mrr.toLocaleString()}</div><div class="sa-stat-sub up">+${rev.mrrGrowthPct}% vs last month</div></div>
      <div class="sa-stat-card"><div class="sa-stat-top"><span class="sa-stat-label">Renewals due this month</span></div><div class="sa-stat-value">${rev.renewalsDueThisMonth}</div><div class="sa-stat-sub">schools up for renewal</div></div>
      <div class="sa-stat-card"><div class="sa-stat-top"><span class="sa-stat-label">Churned this month</span></div><div class="sa-stat-value">${rev.churnedThisMonth}</div><div class="sa-stat-sub ${rev.churnedThisMonth ? 'warn' : ''}">schools cancelled</div></div>
      <div class="sa-stat-card"><div class="sa-stat-top"><span class="sa-stat-label">Plans sold</span></div><div class="sa-stat-value">${rev.byPlan.reduce((n, p) => n + p.schools, 0)}</div><div class="sa-stat-sub">across all tiers</div></div>
    </div>
    <div class="card fade-in"><div class="card-header"><span class="card-title">Revenue by plan</span></div>
      <div class="card-body">
        ${rev.byPlan.map(p => `<div class="revenue-bar-row">
          <div class="revenue-bar-label">${p.plan}</div>
          <div class="revenue-bar-track"><div class="revenue-bar-fill" style="width:${Math.round(p.amount / maxAmount * 100)}%"></div></div>
          <div class="revenue-bar-value">₹${p.amount.toLocaleString()}</div>
        </div>`).join('')}
      </div>
    </div>`;
}

// ================= Support tickets =================
async function renderTickets() {
  const tickets = await cachedApiOrDemo('tickets', () => SuperAdminApi.getTickets(), DEMO_DATA.tickets, 15_000);
  window._allTickets = tickets;
  const el = document.getElementById('saMainContent');
  const open = tickets.filter(t => t.status === 'open').length;
  el.innerHTML = `
    <div class="sa-stats-grid fade-in">
      <div class="sa-stat-card"><div class="sa-stat-top"><span class="sa-stat-label">Open</span></div><div class="sa-stat-value">${open}</div><div class="sa-stat-sub ${open ? 'warn' : ''}">need a response</div></div>
      <div class="sa-stat-card"><div class="sa-stat-top"><span class="sa-stat-label">Pending</span></div><div class="sa-stat-value">${tickets.filter(t => t.status === 'pending').length}</div><div class="sa-stat-sub">awaiting school reply</div></div>
      <div class="sa-stat-card"><div class="sa-stat-top"><span class="sa-stat-label">Resolved</span></div><div class="sa-stat-value">${tickets.filter(t => t.status === 'resolved').length}</div><div class="sa-stat-sub up">this month</div></div>
      <div class="sa-stat-card"><div class="sa-stat-top"><span class="sa-stat-label">High priority</span></div><div class="sa-stat-value">${tickets.filter(t => t.priority === 'high').length}</div><div class="sa-stat-sub">across all statuses</div></div>
    </div>
    <div class="card fade-in"><div class="table-wrap"><table>
      <thead><tr><th>Ticket</th><th>School</th><th>Priority</th><th>Status</th><th>Updated</th></tr></thead>
      <tbody>${tickets.map(ticketRow).join('') || `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">🎫</div><div class="empty-title">No tickets</div></div></td></tr>`}</tbody>
    </table></div></div>`;
}
function ticketRow(t) {
  return `<tr class="row" onclick="viewTicket(${t.id})" style="cursor:pointer">
    <td>${t.subject}</td>
    <td style="color:var(--text3)">${t.schoolName}</td>
    <td><span class="priority-badge priority-${t.priority}">${t.priority}</span></td>
    <td><span class="ticket-status ticket-${t.status}">${t.status}</span></td>
    <td style="color:var(--text3);font-size:0.8rem">${t.updatedAgo}</td>
  </tr>`;
}
function viewTicket(id) {
  const t = (window._allTickets || DEMO_DATA.tickets).find(x => x.id === id);
  if (!t) return;
  document.getElementById('entityDetailTitle').textContent = `Ticket #${t.id}`;
  document.getElementById('entityDetailBody').innerHTML = `
    <div class="sa-detail-block">
      <div class="sa-detail-row"><span>Subject</span><span>${t.subject}</span></div>
      <div class="sa-detail-row"><span>School</span><span>${t.schoolName}</span></div>
      <div class="sa-detail-row"><span>Priority</span><span>${t.priority}</span></div>
      <div class="sa-detail-row"><span>Status</span><span>${t.status}</span></div>
      <div class="sa-detail-row"><span>Updated</span><span>${t.updatedAgo}</span></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:1rem">
      <button class="btn btn-secondary" style="flex:1" onclick="updateTicket(${t.id},'pending')">Mark pending</button>
      <button class="btn btn-primary" style="flex:1" onclick="updateTicket(${t.id},'resolved')">Mark resolved</button>
    </div>`;
  document.getElementById('entityDetailModal').classList.add('show');
  document.getElementById('entityDetailModal').style.display = 'flex';
}
async function updateTicket(id, status) {
  try {
    await SuperAdminApi.updateTicketStatus(id, status);
    showToastSA(`Ticket #${id} marked ${status}`, 'success');
  } catch (e) {
    showToastSA('Connect backend to update ticket status', 'info');
  }
  invalidateCache('tickets');
  closeOverlaySA('entityDetailModal');
  renderTickets();
}

// ================= Impersonation log =================
async function renderImpersonationLog() {
  const log = await cachedApiOrDemo('implog', () => SuperAdminApi.getImpersonationLog(), DEMO_DATA.impersonationLog, 10_000);
  const el = document.getElementById('saMainContent');
  const rows = log.length ? log.map(l => `<div class="log-row">
      <div class="log-dot update"></div>
      <div><div class="log-text">${l.admin} viewed <strong>${l.schoolName}</strong> as School Admin — ${l.reason}</div><div class="log-time">${l.time}</div></div>
    </div>`).join('')
    : `<div class="empty-state"><div class="empty-icon">🔒</div><div class="empty-title">No impersonation sessions yet</div><div style="font-size:0.82rem">Sessions started from a student or school record show up here.</div></div>`;
  el.innerHTML = `<div class="card fade-in"><div class="card-body">${rows}</div></div>`;
}

// ================= Notifications / broadcasts =================
async function renderNotifications() {
  const notifs = await cachedApiOrDemo('notifications', () => SuperAdminApi.getNotifications(), DEMO_DATA.notifications);
  const el = document.getElementById('saMainContent');
  el.innerHTML = `
    <div class="card fade-in"><div class="card-header"><span class="card-title">Send a broadcast</span></div>
      <div class="card-body notif-composer">
        <input type="text" id="notifTitle" placeholder="Title (e.g. Scheduled maintenance — July 30)" class="form-select" style="width:100%">
        <textarea id="notifBody" placeholder="Message to school admins..." style="width:100%;min-height:80px;padding:10px;border-radius:8px;border:1px solid var(--border)"></textarea>
        <select id="notifAudience" class="form-select" style="max-width:220px">
          <option>All schools</option><option>Trial schools</option><option>Basic plan</option><option>Pro & Enterprise</option>
        </select>
        <button class="btn btn-primary" style="align-self:flex-start" onclick="sendNotificationNow()">Send broadcast</button>
      </div>
    </div>
    <div class="card fade-in"><div class="card-header"><span class="card-title">Recently sent</span></div>
      <div class="card-body">${notifs.map(n => `<div class="notif-row">
          <div style="flex:1"><div class="log-text">${n.title}</div><div class="log-time">${n.sentAgo}</div></div>
          <span class="notif-audience">${n.audience}</span>
        </div>`).join('') || `<div class="empty-state"><div class="empty-icon">📢</div><div class="empty-title">No broadcasts sent yet</div></div>`}
      </div>
    </div>`;
}
async function sendNotificationNow() {
  const title = document.getElementById('notifTitle').value.trim();
  const body = document.getElementById('notifBody').value.trim();
  const audience = document.getElementById('notifAudience').value;
  if (!title) { showToastSA('Add a title before sending', 'error'); return; }
  try {
    await SuperAdminApi.sendNotification({ title, body, audience });
    showToastSA('Broadcast sent', 'success');
  } catch (e) {
    showToastSA('Connect backend to send broadcasts', 'info');
  }
  invalidateCache('notifications');
  renderNotifications();
}

// ================= Feature flags =================
async function renderFeatureFlags() {
  const flags = await cachedApiOrDemo('flags', () => SuperAdminApi.getFeatureFlags(), DEMO_DATA.featureFlags, 60_000);
  window._allFlags = flags;
  const el = document.getElementById('saMainContent');
  el.innerHTML = `<div class="card fade-in"><div class="card-body">
    ${flags.map(f => `<div class="flag-row">
        <div><div class="flag-name">${f.name}</div><div class="flag-desc">${f.desc} · ${f.scope}</div></div>
        <label class="toggle">
          <input type="checkbox" ${f.enabled ? 'checked' : ''} onchange="toggleFlag('${f.key}', this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>`).join('')}
  </div></div>`;
}
async function toggleFlag(key, enabled) {
  try {
    await SuperAdminApi.updateFeatureFlag(key, { enabled });
    showToastSA(`${enabled ? 'Enabled' : 'Disabled'} ${key.replace(/_/g, ' ')}`, 'success');
  } catch (e) {
    showToastSA('Saved locally — connect backend to persist', 'info');
  }
  invalidateCache('flags');
}

// ================= API & usage monitor =================
async function renderApiMonitor() {
  const usage = await cachedApiOrDemo('apiusage', () => SuperAdminApi.getApiUsage(), DEMO_DATA.apiUsage, 15_000);
  const el = document.getElementById('saMainContent');
  el.innerHTML = `<div class="card fade-in"><div class="card-header"><span class="card-title">Storage usage by school</span></div>
    <div class="card-body">
      ${usage.map(u => {
        const cls = u.storagePct >= 90 ? 'full' : u.storagePct >= 75 ? 'warn' : 'ok';
        return `<div class="usage-row">
          <div class="usage-row-name">${u.schoolName}</div>
          <div class="usage-row-track"><div class="usage-row-fill ${cls}" style="width:${u.storagePct}%"></div></div>
          <div class="usage-row-pct">${u.storagePct}%</div>
          <div style="width:150px;font-size:0.78rem;color:var(--text3)">${u.apiCallsToday.toLocaleString()} API calls today</div>
          <div style="width:110px;font-size:0.78rem;color:${u.rateLimitHits ? 'var(--danger)' : 'var(--text3)'}">${u.rateLimitHits} rate-limit hits</div>
        </div>`;
      }).join('')}
    </div></div>`;
}

async function renderLogs() {
  const log = await cachedApiOrDemo('activitylog', () => SuperAdminApi.getActivityLog(), DEMO_DATA.activityLog, 10_000);
  const el = document.getElementById('saMainContent');
  const logHtml = log.length ? log.map(l => `<div class="log-row">
      <div class="log-dot ${l.type}"></div>
      <div><div class="log-text">${l.text}</div><div class="log-time">${l.time}</div></div>
    </div>`).join('')
    : `<div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">No activity yet</div>
        <div style="font-size:0.82rem">Actions across the platform will show up here.</div>
      </div>`;
  el.innerHTML = `<div class="card fade-in"><div class="card-body">${logHtml}</div></div>`;
}

function renderSettings() {
  const el = document.getElementById('saMainContent');
  el.innerHTML = `<div class="card fade-in"><div class="card-body">
    <div class="form-section">
      <div class="form-section-title">Platform defaults</div>
      <div class="form-grid">
        <div class="form-group"><label>Default trial length (days)</label><input type="number" value="14"></div>
        <div class="form-group"><label>Default plan on signup</label><select class="form-select"><option>Trial</option><option>Basic</option></select></div>
        <div class="form-group"><label>Support email</label><input type="email" value="support@edureg.app"></div>
        <div class="form-group"><label>Platform base domain</label><input type="text" value="edureg.app"></div>
      </div>
    </div>
  </div></div>`;
}

// ---------- Add / view school ----------
function openAddSchoolModal() {
  document.getElementById('schoolModal').classList.add('show');
  document.getElementById('schoolModal').style.display = 'flex';
}
function closeSchoolModal() {
  document.getElementById('schoolModal').classList.remove('show');
  document.getElementById('schoolModal').style.display = 'none';
}
function previewSubdomain() {
  const v = document.getElementById('schSubdomain').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  document.getElementById('subdomainPreview').textContent = `${v || 'subdomain'}.edureg.app`;
}
function applyPlanDefaults() {
  const plan = document.getElementById('schPlan').value;
  const defaults = {
    trial: [200, 10, 5], basic: [200, 10, 10], pro: [1000, 30, 50], enterprise: [5000, 150, 200],
  };
  const [students, staff, storage] = defaults[plan];
  document.getElementById('schMaxStudents').value = students;
  document.getElementById('schMaxStaff').value = staff;
  document.getElementById('schStorage').value = storage;
}

async function saveSchool() {
  const name = document.getElementById('schName').value.trim();
  const subdomain = document.getElementById('schSubdomain').value.trim();
  const adminEmail = document.getElementById('adminEmail').value.trim();
  if (!name || !subdomain || !adminEmail) {
    showToastSA('School name, subdomain, and admin email are required', 'error');
    return;
  }
  const payload = {
    name, subdomain,
    type: document.getElementById('schType').value,
    address: document.getElementById('schAddress').value,
    city: document.getElementById('schCity').value,
    country: document.getElementById('schCountry').value,
    timezone: document.getElementById('schTimezone').value,
    website: document.getElementById('schWebsite').value,
    adminName: document.getElementById('adminName').value,
    adminTitle: document.getElementById('adminTitle').value,
    adminEmail,
    adminPhone: document.getElementById('adminPhone').value,
    plan: document.getElementById('schPlan').value,
    billingCycle: document.getElementById('schBillingCycle').value,
    maxStudents: Number(document.getElementById('schMaxStudents').value) || 0,
    maxStaff: Number(document.getElementById('schMaxStaff').value) || 0,
    storageGb: Number(document.getElementById('schStorage').value) || 0,
    status: document.getElementById('schStatus').value,
    notes: document.getElementById('schNotes').value,
  };
  try {
    await SuperAdminApi.createSchool(payload);
    showToastSA('School created, invite sent', 'success');
  } catch (e) {
    showToastSA('Saved locally — connect backend to persist', 'info');
  }
  invalidateCache('schools');
  invalidateCache('stats');
  invalidateCache('onboarding');
  closeSchoolModal();
  navigateSA('schools');
}

async function viewSchool(id) {
  const school = (window._allSchools || DEMO_DATA.schools).find(s => s.id === id)
    || await apiOrDemo(() => SuperAdminApi.getSchool(id), null);
  if (!school) return;
  document.getElementById('schoolDetailBody').innerHTML = `
    <div class="sa-detail-grid">
      <div class="sa-detail-block">
        <div class="sa-detail-block-title">Institution</div>
        <div class="sa-detail-row"><span>Name</span><span>${school.name}</span></div>
        <div class="sa-detail-row"><span>Subdomain</span><span>${school.subdomain}.edureg.app</span></div>
        <div class="sa-detail-row"><span>Location</span><span>${school.city}, ${school.country}</span></div>
        <div class="sa-detail-row"><span>Created</span><span>${school.createdAt}</span></div>
      </div>
      <div class="sa-detail-block">
        <div class="sa-detail-block-title">Plan & usage</div>
        <div class="sa-detail-row"><span>Plan</span><span>${school.plan}</span></div>
        <div class="sa-detail-row"><span>Status</span><span>${school.status}</span></div>
        <div class="sa-detail-row"><span>Students</span><span>${school.students}/${school.maxStudents}</span></div>
        <div class="sa-detail-row"><span>Staff</span><span>${school.staff}/${school.maxStaff}</span></div>
      </div>
      <div class="sa-detail-block" style="grid-column:1/-1">
        <div class="sa-detail-block-title">Primary contact</div>
        <div class="sa-detail-row"><span>Name</span><span>${school.adminName}</span></div>
        <div class="sa-detail-row"><span>Email</span><span>${school.adminEmail}</span></div>
      </div>
    </div>`;
  document.getElementById('schoolDetailModal').classList.add('show');
  document.getElementById('schoolDetailModal').style.display = 'flex';
}
function closeOverlaySA(id) {
  document.getElementById(id).classList.remove('show');
  document.getElementById(id).style.display = 'none';
}

// ---------- Suspend / activate ----------
function askConfirmSA(schoolId, action) {
  pendingSchoolId = schoolId;
  pendingConfirmAction = action;
  const isSuspend = action === 'suspend';
  document.getElementById('confirmTitleSA').textContent = isSuspend ? 'Suspend this school?' : 'Activate this school?';
  document.getElementById('confirmTextSA').textContent = isSuspend
    ? 'Staff and students at this school will lose access immediately. This can be reversed.'
    : 'This will restore access for all staff and students at this school.';
  document.getElementById('confirmActionBtnSA').textContent = isSuspend ? 'Suspend' : 'Activate';
  document.getElementById('confirmModalSA').style.display = 'flex';
  document.getElementById('confirmModalSA').classList.add('show');
}
function closeConfirmSA() {
  document.getElementById('confirmModalSA').classList.remove('show');
  document.getElementById('confirmModalSA').style.display = 'none';
}
async function confirmActionSA() {
  try {
    if (pendingConfirmAction === 'suspend') await SuperAdminApi.suspendSchool(pendingSchoolId);
    else await SuperAdminApi.activateSchool(pendingSchoolId);
    showToastSA(`School ${pendingConfirmAction}d`, 'success');
  } catch (e) {
    showToastSA('Connect backend to apply this action', 'info');
  }
  invalidateCache('schools');
  invalidateCache('stats');
  closeConfirmSA();
  renderSchools();
}

async function resendInvite(schoolId) {
  try {
    await SuperAdminApi.resendInvite(schoolId);
    showToastSA('Invite resent', 'success');
  } catch (e) {
    showToastSA('Connect backend to send invites', 'info');
  }
}

function handleLogoutSA() {
  clearCurrentUser();
  window.location.href = 'login.html';
}

function showToastSA(msg, type = 'info') {
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

(function initSuperAdmin() {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (user && user.name) document.getElementById('saUserName').textContent = user.name;
  navigateSA('overview');
})();
