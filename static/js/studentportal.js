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
  documents: [
    { id: 'DOC-1', docType: 'ID Proof', status: 'Verified', uploadedAt: '2026-06-01' },
    { id: 'DOC-2', docType: '12th Marksheet', status: 'Verified', uploadedAt: '2026-06-01' },
    { id: 'DOC-3', docType: 'Transfer Certificate', status: 'Pending Review', uploadedAt: '2026-07-10' },
    { id: 'DOC-4', docType: 'Photo', status: 'Rejected', uploadedAt: '2026-07-15', reviewNote: 'Photo is blurry — please re-upload a clearer copy.' },
  ],
  messages: [
    { id: 1, sender: 'staff', senderName: 'Registrar Office', body: 'Your fee receipt for Semester 6 has been generated.', time: '2 days ago' },
    { id: 2, sender: 'student', body: 'Thank you! Could you also confirm my hostel allotment?', time: '2 days ago' },
    { id: 3, sender: 'staff', senderName: 'Registrar Office', body: 'Yes, you have been allotted Room B-204.', time: '1 day ago' },
  ],
  timetable: [
    { day: 'Monday', start: '09:00', end: '10:00', subject: 'Data Structures', room: 'Room 204', faculty: 'Dr. Sharma' },
    { day: 'Monday', start: '10:00', end: '11:00', subject: 'Database Management Systems', room: 'Room 210', faculty: 'Dr. R. Iyer' },
    { day: 'Tuesday', start: '11:30', end: '12:30', subject: 'Operating Systems', room: 'Room 108', faculty: 'Dr. S. Kapoor' },
    { day: 'Wednesday', start: '10:00', end: '11:00', subject: 'Data Structures', room: 'Room 204', faculty: 'Dr. Sharma' },
    { day: 'Wednesday', start: '14:00', end: '15:00', subject: 'Computer Networks', room: 'Room 302', faculty: 'Prof. M. Nair' },
    { day: 'Thursday', start: '13:00', end: '14:00', subject: 'Software Engineering', room: 'Room 214', faculty: 'Dr. A. Verma' },
    { day: 'Friday', start: '14:00', end: '15:00', subject: 'Computer Networks', room: 'Room 302', faculty: 'Prof. M. Nair' },
  ],
  calendarEvents: [
    { title: 'Mid-Semester Exams Begin', date: '2026-08-10', type: 'Exam' },
    { title: 'Independence Day Holiday', date: '2026-08-15', type: 'Holiday' },
    { title: 'Semester 7 Fee Payment Deadline', date: '2026-08-20', type: 'Deadline' },
    { title: 'Tech Fest — Innovate 2026', date: '2026-09-05', type: 'Event' },
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
    timetable: ['Timetable', 'Your weekly class schedule'],
    calendar: ['Calendar', 'Upcoming academic dates and events'],
    attendance: ['Attendance', 'Your attendance record'],
    documents: ['Documents', 'Upload documents and track verification'],
    fees: ['Fee status', 'Payment history and dues'],
    messages: ['Messages', 'Conversations with your institution'],
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
  if (page === 'timetable') return renderTimetableSP();
  if (page === 'calendar') return renderCalendarSP();
  if (page === 'attendance') return renderAttendanceSP();
  if (page === 'documents') return renderDocumentsSP();
  if (page === 'fees') return renderFeesSP();
  if (page === 'messages') return renderMessagesSP();
  if (page === 'notices') return renderNoticesSP();
}

async function renderDashboardSP() {
  const [profile, attendance, fees, grades, docs, messages] = await Promise.all([
    apiOrDemoSP(() => StudentPortalApi.getProfile(), DEMO_DATA_SP.profile),
    apiOrDemoSP(() => StudentPortalApi.getAttendance(), DEMO_DATA_SP.attendance),
    apiOrDemoSP(() => StudentPortalApi.getFees(), DEMO_DATA_SP.fees),
    apiOrDemoSP(() => StudentPortalApi.getGrades(), DEMO_DATA_SP.grades),
    apiOrDemoSP(() => StudentPortalApi.getDocuments(), DEMO_DATA_SP.documents),
    apiOrDemoSP(() => StudentPortalApi.getMessages(), DEMO_DATA_SP.messages),
  ]);
  const latestGrade = grades[0];
  const pendingDocs = docs.filter(d => d.status === 'Pending Review').length;
  const rejectedDocs = docs.filter(d => d.status === 'Rejected').length;
  const lastMsg = messages[messages.length - 1];
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
      <div class="stat-card" style="cursor:pointer" onclick="navigateSP('documents')">
        <div class="stat-icon red">📄</div>
        <div><div class="stat-value">${docs.length}</div><div class="stat-label">Documents — ${pendingDocs + rejectedDocs > 0 ? `${pendingDocs + rejectedDocs} need attention` : 'all verified'}</div></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 320px;gap:1.5rem">
      <div class="card fade-in">
        <div class="card-header"><span class="card-title">Recent notices</span>
          <button class="btn btn-secondary btn-sm" onclick="navigateSP('notices')">View all</button></div>
        <div class="card-body">
          ${DEMO_DATA_SP.notices.slice(0, 2).map(noticeCardSP).join('')}
        </div>
      </div>
      <div class="card fade-in">
        <div class="card-header"><div class="card-title">Needs your attention</div></div>
        <div class="card-body" style="padding-top:0.5rem;display:flex;flex-direction:column;gap:8px">
          ${pendingDocs > 0 ? `<div class="sp-alert-row sp-alert-amber" onclick="navigateSP('documents')">⏳ <strong>${pendingDocs}</strong> document${pendingDocs !== 1 ? 's' : ''} awaiting staff review</div>` : ''}
          ${rejectedDocs > 0 ? `<div class="sp-alert-row sp-alert-red" onclick="navigateSP('documents')">⚠️ <strong>${rejectedDocs}</strong> document${rejectedDocs !== 1 ? 's' : ''} rejected — re-upload needed</div>` : ''}
          ${fees.totalDue > 0 ? `<div class="sp-alert-row sp-alert-red" onclick="navigateSP('fees')">💳 <strong>₹${fees.totalDue.toLocaleString()}</strong> fee due</div>` : ''}
          ${lastMsg && lastMsg.sender === 'staff' ? `<div class="sp-alert-row sp-alert-blue" onclick="navigateSP('messages')">💬 New reply from ${escapeHtmlSP(lastMsg.senderName || 'staff')}</div>` : ''}
          ${(pendingDocs + rejectedDocs === 0 && fees.totalDue === 0) ? `<div style="color:var(--text3);font-size:0.85rem;text-align:center;padding:12px">✅ You're all caught up</div>` : ''}
        </div>
        <div class="card-header" style="margin-top:0.75rem"><div class="card-title">Quick links</div></div>
        <div class="card-body" style="padding-top:0.5rem;display:flex;flex-wrap:wrap;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="navigateSP('timetable')">🗓️ Timetable</button>
          <button class="btn btn-secondary btn-sm" onclick="navigateSP('calendar')">📅 Calendar</button>
          <button class="btn btn-secondary btn-sm" onclick="navigateSP('messages')">💬 Messages</button>
        </div>
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
    </div></div>
    <div style="display:flex;justify-content:flex-end;margin-top:1rem" class="fade-in">
      <button class="btn btn-primary" onclick="openIdCardSP()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><line x1="14" y1="10" x2="18" y2="10"/><line x1="14" y1="14" x2="18" y2="14"/></svg>
        View digital ID card
      </button>
    </div>`;
}

async function renderCoursesSP() {
  const courses = await apiOrDemoSP(() => StudentPortalApi.getCourses(), DEMO_DATA_SP.courses);
  const el = document.getElementById('spMainContent');
  if (!courses.length) {
    el.innerHTML = `<div class="card fade-in"><div class="empty-state">
      <div class="empty-icon">📚</div>
      <div class="empty-title">No courses enrolled yet</div>
      <div style="font-size:0.82rem">Your enrolled courses will appear here once added by staff.</div>
    </div></div>`;
    return;
  }
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
  const rowsHtml = grades.length ? grades.map(g => `<tr>
      <td>${g.course}</td><td>${g.term}</td>
      <td><span class="grade-badge grade-${g.grade.toLowerCase()}">${g.grade}</span></td>
      <td>${g.gpa}</td><td style="color:var(--text3);font-size:0.8rem">${g.date}</td>
    </tr>`).join('')
    : `<tr><td colspan="5"><div class="empty-state">
        <div class="empty-icon">🎓</div>
        <div class="empty-title">No grades recorded yet</div>
        <div style="font-size:0.82rem">Grades will show up here once your instructors submit them.</div>
      </div></td></tr>`;
  el.innerHTML = `<div class="card fade-in"><div class="table-wrap"><table>
    <thead><tr><th>Course</th><th>Term</th><th>Grade</th><th>GPA</th><th>Recorded</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
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
  if (!notices.length) {
    el.innerHTML = `<div class="card fade-in"><div class="empty-state">
      <div class="empty-icon">🔔</div>
      <div class="empty-title">No notices right now</div>
      <div style="font-size:0.82rem">Announcements from your institution will appear here.</div>
    </div></div>`;
    return;
  }
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

// ===== DOCUMENTS =====
// A student can submit any number of documents (ID proof, marksheets,
// certificates, re-uploads after rejection) — each is its own row with its
// own verification status set by staff on the other side of this same
// feature (see DocumentsApi on the staff dashboard).
async function renderDocumentsSP() {
  const docs = await apiOrDemoSP(() => StudentPortalApi.getDocuments(), DEMO_DATA_SP.documents);
  const el = document.getElementById('spMainContent');
  const verified = docs.filter(d => d.status === 'Verified').length;
  const pending = docs.filter(d => d.status === 'Pending Review').length;
  const rejected = docs.filter(d => d.status === 'Rejected').length;

  updateDocBadgeSP(pending + rejected);

  el.innerHTML = `
    <div class="stats-grid fade-in">
      <div class="stat-card"><div class="stat-icon blue">📄</div><div><div class="stat-value">${docs.length}</div><div class="stat-label">Total documents</div></div></div>
      <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value">${verified}</div><div class="stat-label">Verified</div></div></div>
      <div class="stat-card"><div class="stat-icon amber">⏳</div><div><div class="stat-value">${pending}</div><div class="stat-label">Pending review</div></div></div>
      <div class="stat-card"><div class="stat-icon red">❌</div><div><div class="stat-value">${rejected}</div><div class="stat-label">Needs re-upload</div></div></div>
    </div>
    <div class="toolbar fade-in">
      <span style="font-size:0.8rem;color:var(--text3)">Staff review each document you submit — you can upload as many as you need</span>
      <button class="btn btn-primary" style="margin-left:auto" onclick="openDocUploadModalSP()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Upload document
      </button>
    </div>
    <div class="card fade-in">
      ${docs.length === 0 ? `<div class="empty-state">
        <div class="empty-icon">📄</div>
        <div class="empty-title">No documents uploaded yet</div>
        <div style="font-size:0.82rem">Upload your ID proof, marksheets, and certificates to get verified.</div>
      </div>` : docs.map(docCardSP).join('')}
    </div>`;
}

function docCardSP(d) {
  const statusClass = 'doc-status-' + d.status.toLowerCase().replace(/\s+/g, '-');
  return `<div style="display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid var(--border)">
    <div style="width:38px;height:38px;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.1rem">📄</div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:600;font-size:0.88rem">${escapeHtmlSP(d.docType)}</div>
      <div style="font-size:0.75rem;color:var(--text3)">Uploaded ${d.uploadedAt}</div>
      ${d.status === 'Rejected' && d.reviewNote ? `<div style="font-size:0.78rem;color:#dc2626;margin-top:4px">⚠️ ${escapeHtmlSP(d.reviewNote)}</div>` : ''}
    </div>
    <span class="status ${statusClass}"><span class="status-dot"></span>${d.status}</span>
    ${d.status === 'Rejected' ? `<button class="btn btn-secondary btn-sm" onclick="openDocUploadModalSP('${d.docType}')">Re-upload</button>` : ''}
  </div>`;
}

function updateDocBadgeSP(count) {
  const badge = document.getElementById('docBadge');
  if (!badge) return;
  if (count > 0) { badge.textContent = count; badge.style.display = 'inline-block'; }
  else { badge.style.display = 'none'; }
}

function openDocUploadModalSP(prefillType) {
  document.getElementById('spDocType').value = prefillType || 'ID Proof';
  document.getElementById('spDocFileLabel').textContent = '📄 Click to choose a file';
  document.getElementById('spDocFileInput').value = '';
  showModalSP('spDocUploadModal');
}

async function submitDocUploadSP() {
  const file = document.getElementById('spDocFileInput').files[0];
  if (!file) { showToastSP('Please choose a file to upload', 'error'); return; }
  const docType = document.getElementById('spDocType').value;

  try {
    await StudentPortalApi.uploadDocument({ file, docType });
    showToastSP('Document uploaded — pending review', 'success');
  } catch (err) {
    // Demo-mode fallback so the page stays useful before the backend route exists.
    DEMO_DATA_SP.documents.unshift({ id: 'DOC-' + Date.now(), docType, status: 'Pending Review', uploadedAt: new Date().toISOString().slice(0, 10) });
    showToastSP('Document uploaded (demo mode — no backend route yet)', 'info');
  }
  closeOverlaySP('spDocUploadModal');
  renderDocumentsSP();
}

// ===== MESSAGES =====
// A single thread between this student and institution staff — connects to
// the staff dashboard's Messages page from the other side.
async function renderMessagesSP() {
  const messages = await apiOrDemoSP(() => StudentPortalApi.getMessages(), DEMO_DATA_SP.messages);
  const el = document.getElementById('spMainContent');
  el.innerHTML = `
    <div class="card fade-in" style="display:flex;flex-direction:column;height:calc(100vh - 170px)">
      <div class="card-header">
        <span class="card-title">Registrar office</span>
        <span style="font-size:0.75rem;color:var(--text3)">Usually replies within a day</span>
      </div>
      <div id="spMsgThread" style="flex:1;overflow-y:auto;padding:1.25rem;display:flex;flex-direction:column;gap:12px">
        ${messages.length ? messages.map(msgBubbleSP).join('') : `<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-title">No messages yet</div><div style="font-size:0.82rem">Send a message to your institution's staff below.</div></div>`}
      </div>
      <div style="display:flex;gap:10px;padding:1rem 1.25rem;border-top:1px solid var(--border)">
        <input type="text" id="spMsgInput" placeholder="Type a message…" style="flex:1" onkeydown="if(event.key==='Enter')sendMessageSP()">
        <button class="btn btn-primary" onclick="sendMessageSP()">Send</button>
      </div>
    </div>`;
  const thread = document.getElementById('spMsgThread');
  if (thread) thread.scrollTop = thread.scrollHeight;
}

function msgBubbleSP(m) {
  const mine = m.sender === 'student';
  return `<div style="display:flex;flex-direction:column;align-items:${mine ? 'flex-end' : 'flex-start'}">
    ${!mine ? `<div style="font-size:0.7rem;color:var(--text3);margin-bottom:2px">${escapeHtmlSP(m.senderName || 'Staff')}</div>` : ''}
    <div style="max-width:70%;padding:10px 14px;border-radius:${mine ? '14px 14px 2px 14px' : '14px 14px 14px 2px'};background:${mine ? 'var(--accent)' : 'var(--surface2)'};color:${mine ? '#fff' : 'var(--text)'};font-size:0.87rem;line-height:1.4">${escapeHtmlSP(m.body)}</div>
    <div style="font-size:0.68rem;color:var(--text3);margin-top:3px">${m.time}</div>
  </div>`;
}

async function sendMessageSP() {
  const input = document.getElementById('spMsgInput');
  const body = input.value.trim();
  if (!body) return;
  input.value = '';
  try {
    await StudentPortalApi.sendMessage(body);
  } catch (err) {
    // Demo-mode fallback — keep the conversation usable before the backend route exists.
  }
  DEMO_DATA_SP.messages.push({ id: Date.now(), sender: 'student', body, time: 'Just now' });
  renderMessagesSP();
}

// ===== TIMETABLE =====
// This student's own weekly class schedule — mirrors the staff dashboard's
// Timetable page, just filtered down to their course automatically on the backend.
async function renderTimetableSP() {
  const entries = await apiOrDemoSP(() => StudentPortalApi.getTimetable(), DEMO_DATA_SP.timetable);
  const el = document.getElementById('spMainContent');
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const byDay = days.map(day => ({ day, classes: entries.filter(e => e.day === day).sort((a, b) => a.start.localeCompare(b.start)) })).filter(d => d.classes.length);

  if (!byDay.length) {
    el.innerHTML = `<div class="card fade-in"><div class="empty-state">
      <div class="empty-icon">🗓️</div>
      <div class="empty-title">No timetable published yet</div>
      <div style="font-size:0.82rem">Your class schedule will appear here once staff set it up.</div>
    </div></div>`;
    return;
  }

  el.innerHTML = `<div class="fade-in" style="display:flex;flex-direction:column;gap:1rem">
    ${byDay.map(d => `
      <div class="card">
        <div class="card-header"><span class="card-title">${d.day}</span><span style="font-size:0.75rem;color:var(--text3)">${d.classes.length} class${d.classes.length !== 1 ? 'es' : ''}</span></div>
        <div class="card-body" style="padding-top:0">
          ${d.classes.map(c => `
            <div style="display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid var(--border)">
              <div style="min-width:100px;font-size:0.78rem;color:var(--text3);font-weight:600">${c.start} – ${c.end}</div>
              <div style="flex:1">
                <div style="font-weight:600;font-size:0.88rem">${c.subject}</div>
                <div style="font-size:0.76rem;color:var(--text3)">${c.faculty} · ${c.room}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>`).join('')}
  </div>`;
}

// ===== CALENDAR =====
// Upcoming exams, holidays, deadlines, and events — mirrors the staff
// dashboard's Calendar page, read-only from the student's side.
async function renderCalendarSP() {
  const events = await apiOrDemoSP(() => StudentPortalApi.getCalendarEvents(), DEMO_DATA_SP.calendarEvents);
  const el = document.getElementById('spMainContent');
  const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
  const typeColors = { Exam: ['#fef2f2', '#dc2626'], Holiday: ['#f0fdf4', '#16a34a'], Deadline: ['#fffbeb', '#d97706'], Event: ['#eff6ff', '#2563eb'] };

  if (!sorted.length) {
    el.innerHTML = `<div class="card fade-in"><div class="empty-state">
      <div class="empty-icon">📅</div>
      <div class="empty-title">No upcoming events</div>
      <div style="font-size:0.82rem">Academic dates and announcements will appear here.</div>
    </div></div>`;
    return;
  }

  el.innerHTML = `<div class="fade-in" style="display:flex;flex-direction:column;gap:10px">
    ${sorted.map(ev => {
      const d = new Date(ev.date);
      const [bg, fg] = typeColors[ev.type] || ['var(--surface2)', 'var(--text2)'];
      return `<div class="card" style="display:flex;align-items:center;gap:16px;padding:1rem 1.25rem">
        <div style="width:52px;height:52px;border-radius:var(--radius-sm);background:${bg};color:${fg};display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0">
          <div style="font-size:1.1rem;font-weight:700;line-height:1">${d.getDate()}</div>
          <div style="font-size:0.6rem;text-transform:uppercase;font-weight:700;letter-spacing:0.5px">${d.toLocaleString('default', { month: 'short' })}</div>
        </div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:0.9rem">${escapeHtmlSP(ev.title)}</div>
          <div style="font-size:0.76rem;color:var(--text3)">${d.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
        <span style="background:${bg};color:${fg};font-size:0.7rem;font-weight:700;padding:4px 10px;border-radius:99px">${ev.type}</span>
      </div>`;
    }).join('')}
  </div>`;
}

// ===== DIGITAL ID CARD =====
// A small bonus feature living on the Profile page: a printable digital ID
// built entirely from data already on this page (name, roll no, course,
// status) — no new backend route required.
async function openIdCardSP() {
  const p = await apiOrDemoSP(() => StudentPortalApi.getProfile(), DEMO_DATA_SP.profile);
  document.getElementById('spIdCardBody').innerHTML = idCardHtmlSP(p);
  showModalSP('spIdCardModal');
}

function idCardHtmlSP(p) {
  return `
  <div id="idCardPrintArea" class="sp-idcard">
    <div class="sp-idcard-top">
      <div class="sp-idcard-logo">Edu<span>Reg</span></div>
      <div class="sp-idcard-institute">STUDENT IDENTITY CARD</div>
    </div>
    <div class="sp-idcard-body">
      <div class="sp-idcard-photo">${initialsSP(p)}</div>
      <div class="sp-idcard-info">
        <div class="sp-idcard-name">${p.firstName} ${p.lastName}</div>
        <div class="sp-idcard-row"><span>Roll No.</span><b>${p.rollNo}</b></div>
        <div class="sp-idcard-row"><span>Course</span><b>${p.course}</b></div>
        <div class="sp-idcard-row"><span>Year</span><b>${p.year}</b></div>
      </div>
    </div>
    <div class="sp-idcard-bottom">
      ${pseudoQrSP(p.rollNo || 'EDUREG')}
      <div class="sp-idcard-status">${p.status === 'Active' ? '✅ Active student' : p.status}</div>
    </div>
  </div>`;
}

// Deterministic "scan pattern" derived from the roll number — not a real
// QR code, just a recognizable, always-consistent id-card visual signature.
function pseudoQrSP(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  let cells = '';
  for (let i = 0; i < 64; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const on = (h >> 16) % 3 !== 0;
    cells += `<div style="background:${on ? '#1a1a2e' : 'transparent'}"></div>`;
  }
  return `<div class="sp-qr-grid">${cells}</div>`;
}

// ===== SHARED UI HELPERS (modals/toasts — this page doesn't load script.js) =====
function escapeHtmlSP(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function showModalSP(id) {
  const m = document.getElementById(id);
  m.style.display = 'flex';
  requestAnimationFrame(() => m.classList.add('show'));
}

function closeOverlaySP(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('show');
  setTimeout(() => { m.style.display = 'none'; }, 200);
}

function showToastSP(msg, type = 'info') {
  const cont = document.getElementById('toastContainer');
  const t = document.createElement('div');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
  cont.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') ['spDocUploadModal', 'spIdCardModal'].forEach(closeOverlaySP);
});

function handleLogoutSP() {
  clearCurrentUser();
  window.location.href = 'login.html';
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
  const needsAttention = DEMO_DATA_SP.documents.filter(d => d.status !== 'Verified').length;
  updateDocBadgeSP(needsAttention);
  navigateSP('dashboard');
})();
