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
  schools: [
    { id: 1, name: 'Sunrise Institute of Technology', subdomain: 'sunrise', city: 'Nashik', country: 'India',
      plan: 'pro', status: 'Active', students: 640, maxStudents: 1000, staff: 22, maxStaff: 30,
      adminName: 'Priya Sharma', adminEmail: 'priya@sunrise.edu', createdAt: '2026-02-14' },
    { id: 2, name: 'Greenfield College', subdomain: 'greenfield', city: 'Pune', country: 'India',
      plan: 'trial', status: 'Trial', students: 85, maxStudents: 200, staff: 4, maxStaff: 10,
      adminName: 'Arjun Mehta', adminEmail: 'arjun@greenfield.edu', createdAt: '2026-07-15' },
    { id: 3, name: 'Northlake University', subdomain: 'northlake', city: 'Bengaluru', country: 'India',
      plan: 'enterprise', status: 'Active', students: 3200, maxStudents: 5000, staff: 95, maxStaff: 150,
      adminName: 'Kavita Rao', adminEmail: 'kavita@northlake.edu', createdAt: '2025-11-02' },
    { id: 4, name: 'Riverside Coaching Center', subdomain: 'riverside', city: 'Mumbai', country: 'India',
      plan: 'basic', status: 'Suspended', students: 120, maxStudents: 150, staff: 6, maxStaff: 8,
      adminName: 'Sanjay Patel', adminEmail: 'sanjay@riverside.edu', createdAt: '2026-01-20' },
  ],
  activityLog: [
    { type: 'create', text: 'Greenfield College onboarded on trial plan', time: '2 hours ago' },
    { type: 'suspend', text: 'Riverside Coaching Center suspended — payment overdue', time: '1 day ago' },
    { type: 'update', text: 'Sunrise Institute upgraded from Basic to Pro', time: '3 days ago' },
    { type: 'create', text: 'Northlake University onboarded on enterprise plan', time: '2 months ago' },
  ],
};

async function apiOrDemo(apiCall, demoValue) {
  try {
    return await apiCall();
  } catch (e) {
    return demoValue;
  }
}

function navigateSA(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  const titles = {
    overview: ['Platform overview', 'All schools on EduReg'],
    schools: ['Schools', 'Manage tenant institutions'],
    admins: ['School admins', 'Primary contacts across all schools'],
    plans: ['Plans & billing', 'Subscription tiers and revenue'],
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
  if (page === 'admins') return renderAdmins();
  if (page === 'plans') return renderPlans();
  if (page === 'logs') return renderLogs();
  if (page === 'settings') return renderSettings();
}

async function renderOverview() {
  const stats = await apiOrDemo(() => SuperAdminApi.getStats(), DEMO_DATA.stats);
  const schools = await apiOrDemo(() => SuperAdminApi.getSchools(), DEMO_DATA.schools);
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
  const schools = await apiOrDemo(
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

async function renderAdmins() {
  const schools = await apiOrDemo(() => SuperAdminApi.getSchools(), DEMO_DATA.schools);
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
  const stats = await apiOrDemo(() => SuperAdminApi.getStats(), DEMO_DATA.stats);
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

async function renderLogs() {
  const log = await apiOrDemo(() => SuperAdminApi.getActivityLog(), DEMO_DATA.activityLog);
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
  window.location.href = 'login_signup.html';
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
