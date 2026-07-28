// ===== STUDENT PORTAL UI LOGIC =====
// Renders pages and wires up StudentPortalApi (student-api-client.js).
// Falls back to DEMO_DATA when backend routes aren't implemented yet so
// the UI is previewable before controller.py/model.py support it.
// Remove DEMO_DATA fallbacks once your backend routes are live.

let currentPageSP = 'dashboard';

const DEMO_DATA_SP = {
  profile: {
    firstName: 'Aditi', lastName: 'Kulkarni', rollNo: 'CS2023-041',
    email: 'aditi.kulkarni@sunrise.edu', phone: '+91 98765 43210',
    course: 'B.Tech Computer Science', year: '3rd Year', gender: 'Female',
    dob: '2004-03-12', address: 'Nashik, Maharashtra', status: 'Active',
  },
  courses: [
    { code: 'CS301', name: 'Database Management Systems', instructor: 'Dr. R. Iyer', credits: 4, schedule: 'Mon, Wed 10:00 AM' },
    { code: 'CS302', name: 'Operating Systems', instructor: 'Dr. S. Kapoor', credits: 4, schedule: 'Tue, Thu 11:30 AM' },
    { code: 'CS303', name: 'Computer Networks', instructor: 'Prof. M. Nair', credits: 3, schedule: 'Wed, Fri 2:00 PM' },
    { code: 'CS304', name: 'Software Engineering', instructor: 'Dr. A. Verma', credits: 3, schedule: 'Mon, Thu 1:00 PM' },
  ],
  grades: [
    { course: 'Data Structures', term: 'Semester 4', grade: 'A', gpa: 9.2, date: '2026-05-20' },
    { course: 'Discrete Mathematics', term: 'Semester 4', grade: 'B', gpa: 7.8, date: '2026-05-20' },
    { course: 'Computer Organization', term: 'Semester 4', grade: 'A', gpa: 9.0, date: '2026-05-18' },
    { course: 'Web Technologies', term: 'Semester 3', grade: 'A', gpa: 9.4, date: '2025-12-10' },
  ],
  attendance: {
    overall: 84,
    subjects: [
      { name: 'Database Management Systems', pct: 88 },
      { name: 'Operating Systems', pct: 76 },
      { name: 'Computer Networks', pct: 91 },
      { name: 'Software Engineering', pct: 82 },
    ],
  },
  fees: {
    totalDue: 0, totalPaid: 85000, nextDueDate: null, status: 'Paid',
    history: [
      { label: 'Semester 6 tuition', amount: 45000, date: '2026-07-05', status: 'Paid' },
      { label: 'Semester 5 tuition', amount: 40000, date: '2026-01-10', status: 'Paid' },
    ],
  },
  notices: [
    { title: 'Mid-semester exam schedule released', body: 'Check the exam portal for your seat allocation.', time: '2 days ago', unread: true },
    { title: 'Library hours extended', body: 'Open until 10 PM during exam week.', time: '5 days ago', unread: true },
    { title: 'Fee payment reminder', body: 'Semester 6 fees were due — now cleared.', time: '3 weeks ago', unread: false },
  ],
};

async function apiOrDemoSP(apiCall, demoValue) {
  try {
    return await apiCall();
  } catch (e) {
    return demoValue;
  }
}

function navigateSP(page) {
  currentPageSP = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  const titles = {
    dashboard: ['Dashboard', 'Welcome back'],
    profile: ['My profile', 'Your personal and academic details'],
    courses: ['My courses', 'Courses you are enrolled in'],
    grades: ['My grades', 'Your academic performance'],
    attendance: ['Attendance', 'Your attendance record'],
    fees: ['Fee status', 'Payment history and dues'],
    notices: ['Notices', 'Announcements from your institution'],
  };
  document.getElementById('spPageTitle').textContent = titles[page][0];
  document.getElementById('spPageSubtitle').textContent = titles[page][1];
  renderPageSP(page);
}

async function renderPageSP(page) {
  const el = document.getElementById('spMainContent');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';
  if (page === 'dashboard') return renderDashboardSP();
  if (page === 'profile') return renderProfileSP();
  if (page === 'courses') return renderCoursesSP();
  if (page === 'grades') return renderGradesSP();
  if (page === 'attendance') return renderAttendanceSP();
  if (page === 'fees') return renderFeesSP();
  if (page === 'notices') return renderNoticesSP();
}

async function renderDashboardSP() {
  const [profile, attendance, fees, grades] = await Promise.all([
    apiOrDemoSP(() => StudentPortalApi.getProfile(), DEMO_DATA_SP.profile),
    apiOrDemoSP(() => StudentPortalApi.getAttendance(), DEMO_DATA_SP.attendance),
    apiOrDemoSP(() => StudentPortalApi.getFees(), DEMO_DATA_SP.fees),
    apiOrDemoSP(() => StudentPortalApi.getGrades(), DEMO_DATA_SP.grades),
  ]);
  const latestGrade = grades[0];
  const el = document.getElementById('spMainContent');
  el.innerHTML = `
    <div class="sp-profile-header fade-in">
      <div class="sp-profile-avatar">${initialsSP(profile)}</div>
      <div>
        <div class="sp-profile-name">${profile.firstName} ${profile.lastName}</div>
        <div class="sp-profile-meta">${profile.rollNo} · ${profile.course} · ${profile.year}</div>
      </div>
    </div>
    <div class="stats-grid fade-in">
      <div class="stat-card">
        <div class="stat-icon blue">📚</div>
        <div><div class="stat-value">${DEMO_DATA_SP.courses.length}</div><div class="stat-label">Enrolled courses</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">✅</div>
        <div><div class="stat-value">${attendance.overall}%</div><div class="stat-label">Overall attendance</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon amber">🎓</div>
        <div><div class="stat-value">${latestGrade ? latestGrade.grade : '-'}</div><div class="stat-label">Latest grade — ${latestGrade ? latestGrade.course : ''}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red">💳</div>
        <div><div class="stat-value">${fees.status}</div><div class="stat-label">Fee status</div></div>
      </div>
    </div>
    <div class="card fade-in">
      <div class="card-header"><span class="card-title">Recent notices</span>
        <button class="btn btn-secondary btn-sm" onclick="navigateSP('notices')">View all</button></div>
      <div class="card-body">
        ${DEMO_DATA_SP.notices.slice(0, 2).map(noticeCardSP).join('')}
      </div>
    </div>`;
}

function initialsSP(p) {
  return `${(p.firstName || '?')[0]}${(p.lastName || '?')[0]}`.toUpperCase();
}

async function renderProfileSP() {
  const p = await apiOrDemoSP(() => StudentPortalApi.getProfile(), DEMO_DATA_SP.profile);
  const el = document.getElementById('spMainContent');
  el.innerHTML = `
    <div class="sp-readonly-note fade-in">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      This information is managed by your institution. Contact the registrar's office to request a change.
    </div>
    <div class="card fade-in"><div class="card-body">
      <div class="sp-field-grid">
        <div class="sp-field"><span class="sp-field-label">Full name</span><span class="sp-field-value">${p.firstName} ${p.lastName}</span></div>
        <div class="sp-field"><span class="sp-field-label">Roll number</span><span class="sp-field-value">${p.rollNo}</span></div>
        <div class="sp-field"><span class="sp-field-label">Email</span><span class="sp-field-value">${p.email}</span></div>
        <div class="sp-field"><span class="sp-field-label">Phone</span><span class="sp-field-value">${p.phone}</span></div>
        <div class="sp-field"><span class="sp-field-label">Course</span><span class="sp-field-value">${p.course}</span></div>
        <div class="sp-field"><span class="sp-field-label">Year</span><span class="sp-field-value">${p.year}</span></div>
        <div class="sp-field"><span class="sp-field-label">Date of birth</span><span class="sp-field-value">${p.dob}</span></div>
        <div class="sp-field"><span class="sp-field-label">Gender</span><span class="sp-field-value">${p.gender}</span></div>
        <div class="sp-field"><span class="sp-field-label">Address</span><span class="sp-field-value">${p.address}</span></div>
        <div class="sp-field"><span class="sp-field-label">Status</span><span class="status status-active"><span class="status-dot"></span>${p.status}</span></div>
      </div>
    </div></div>`;
}

async function renderCoursesSP() {
  const courses = await apiOrDemoSP(() => StudentPortalApi.getCourses(), DEMO_DATA_SP.courses);
  const el = document.getElementById('spMainContent');
  el.innerHTML = `<div class="sp-course-grid fade-in">
    ${courses.map(c => `
      <div class="sp-course-card">
        <div class="sp-course-code">${c.code}</div>
        <div class="sp-course-name">${c.name}</div>
        <div class="sp-field-value" style="color:var(--text2);font-size:0.85rem">${c.instructor}</div>
        <div class="sp-course-meta"><span>${c.credits} credits</span><span>${c.schedule}</span></div>
      </div>`).join('')}
  </div>`;
}

async function renderGradesSP() {
  const grades = await apiOrDemoSP(() => StudentPortalApi.getGrades(), DEMO_DATA_SP.grades);
  const el = document.getElementById('spMainContent');
  el.innerHTML = `<div class="card fade-in"><div class="table-wrap"><table>
    <thead><tr><th>Course</th><th>Term</th><th>Grade</th><th>GPA</th><th>Recorded</th></tr></thead>
    <tbody>${grades.map(g => `<tr>
      <td>${g.course}</td><td>${g.term}</td>
      <td><span class="grade-badge grade-${g.grade.toLowerCase()}">${g.grade}</span></td>
      <td>${g.gpa}</td><td style="color:var(--text3);font-size:0.8rem">${g.date}</td>
    </tr>`).join('')}</tbody>
  </table></div></div>`;
}

async function renderAttendanceSP() {
  const att = await apiOrDemoSP(() => StudentPortalApi.getAttendance(), DEMO_DATA_SP.attendance);
  const el = document.getElementById('spMainContent');
  const ringColor = att.overall >= 85 ? 'var(--success)' : att.overall >= 75 ? 'var(--warning)' : 'var(--danger)';
  const circumference = 2 * Math.PI * 42;
  const offset = circumference * (1 - att.overall / 100);
  el.innerHTML = `
    <div class="sp-att-wrap fade-in">
      <div class="sp-att-ring">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface3)" stroke-width="8"/>
          <circle cx="50" cy="50" r="42" fill="none" stroke="${ringColor}" stroke-width="8"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"
            transform="rotate(-90 50 50)"/>
        </svg>
        <div class="sp-att-pct">${att.overall}%</div>
      </div>
      <div class="sp-att-detail">
        <div style="font-weight:600;margin-bottom:6px">Overall attendance</div>
        <div style="font-size:0.82rem;color:var(--text3)">Minimum required: 75%</div>
      </div>
    </div>
    <div class="card fade-in"><div class="card-body">
      ${att.subjects.map(s => `<div class="sp-att-row"><span>${s.name}</span><span style="font-weight:600">${s.pct}%</span></div>`).join('')}
    </div></div>`;
}

async function renderFeesSP() {
  const fees = await apiOrDemoSP(() => StudentPortalApi.getFees(), DEMO_DATA_SP.fees);
  const el = document.getElementById('spMainContent');
  el.innerHTML = `
    <div class="sp-fee-card fade-in">
      <div class="sp-fee-top">
        <div>
          <div class="sp-fee-label">Amount due</div>
          <div class="sp-fee-amount">₹${fees.totalDue.toLocaleString()}</div>
        </div>
        <span class="status status-${fees.status === 'Paid' ? 'active' : 'pending'}"><span class="status-dot"></span>${fees.status}</span>
      </div>
      <div class="sp-fee-label">Total paid to date: ₹${fees.totalPaid.toLocaleString()}</div>
    </div>
    <div class="card fade-in"><div class="table-wrap"><table>
      <thead><tr><th>Description</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
      <tbody>${fees.history.map(h => `<tr>
        <td>${h.label}</td><td>₹${h.amount.toLocaleString()}</td>
        <td style="color:var(--text3);font-size:0.8rem">${h.date}</td>
        <td><span class="status status-active"><span class="status-dot"></span>${h.status}</span></td>
      </tr>`).join('')}</tbody>
    </table></div></div>`;
}

async function renderNoticesSP() {
  const notices = await apiOrDemoSP(() => StudentPortalApi.getNotices(), DEMO_DATA_SP.notices);
  const el = document.getElementById('spMainContent');
  el.innerHTML = `<div class="fade-in">${notices.map(noticeCardSP).join('')}</div>`;
}

function noticeCardSP(n) {
  return `<div class="notice-card ${n.unread ? 'unread' : ''}">
    <div class="notice-icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
    </div>
    <div>
      <div class="notice-title">${n.title}</div>
      <div class="notice-body">${n.body}</div>
      <div class="notice-time">${n.time}</div>
    </div>
  </div>`;
}

function handleLogoutSP() {
  clearCurrentUser();
  window.location.href = 'login_signup.html';
}

(function initStudentPortal() {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (user) {
    if (user.name) {
      document.getElementById('spUserName').textContent = user.name;
      const parts = user.name.split(' ');
      document.getElementById('spAvatar').textContent = `${(parts[0] || '?')[0]}${(parts[1] || '')[0] || ''}`.toUpperCase();
    }
    if (user.rollNo) document.getElementById('spUserRoll').textContent = user.rollNo;
  }
  const unreadCount = DEMO_DATA_SP.notices.filter(n => n.unread).length;
  if (unreadCount > 0) {
    const badge = document.getElementById('noticeBadge');
    badge.textContent = unreadCount;
    badge.style.display = 'inline-block';
  }
  navigateSP('dashboard');
})();
