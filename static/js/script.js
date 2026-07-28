// ===== COURSE COLORS (used for rendering) =====
let COURSES_COLORS = {
  'Computer Science': ['#eff6ff','#2563eb'],
  'Business Administration': ['#fdf4ff','#9333ea'],
  'Electrical Engineering': ['#fff7ed','#ea580c'],
  'Mathematics': ['#f0fdf4','#16a34a'],
  'Physics': ['#fff1f2','#e11d48'],
  'Data Science': ['#ecfdf5','#059669'],
  'Mechanical Engineering': ['#fffbeb','#d97706'],
  'Civil Engineering': ['#f1f5f9','#475569'],
};
let coursesCache = Object.keys(COURSES_COLORS).map(name => ({name, color_bg: COURSES_COLORS[name][0], color_fg: COURSES_COLORS[name][1]}));

// ===== NOTIFICATION TYPES =====
const NOTIF_TYPES = {
  info:     { label: 'Info',     icon: 'ℹ️', cls: 'notif-type-info' },
  reminder: { label: 'Reminder', icon: '⏰', cls: 'notif-type-reminder' },
  academic: { label: 'Academic', icon: '🎓', cls: 'notif-type-academic' },
  event:    { label: 'Event',    icon: '📅', cls: 'notif-type-event' },
  warning:  { label: 'Warning',  icon: '⚠️', cls: 'notif-type-warning' },
  urgent:   { label: 'Urgent',   icon: '🚨', cls: 'notif-type-urgent' },
};

// ===== STATE =====
let currentPage = 'dashboard';
let editingId = null;
let deleteId = null;
let viewMode = 'table';
let searchQ = '';
let filterCourse = '';
let filterStatus = '';
let currentPageNum = 1;
const PER_PAGE = 5;
let notifTypeFilter = '';
let dismissedAlertKeys = JSON.parse(localStorage.getItem('eduregDismissedAlerts') || '[]');

// =====================================================================
// MOCK / LOCAL DATA — everything below this line is placeholder state.
// It is NOT wired to a backend. Swap each TODO for a real API call
// (e.g. AttendanceApi.getRecords(), FeesApi.createRecord(), etc.)
// once your endpoints exist. Function names are already structured so
// the swap is usually a one-line change inside each submit/load function.
// =====================================================================
let studentsCache = [];               // populated by ensureStudentsCache()
let attendanceRecords = [];            // TODO: GET /attendance
let feeRecords = [                     // TODO: GET /fees
  { id:'FEE-1001', studentId:'', studentName:'Sample: Aditi Rao', feeType:'Tuition', amount:45000, status:'Paid', dueDate:'2026-06-15', notes:'Paid via UPI' },
  { id:'FEE-1002', studentId:'', studentName:'Sample: Rohan Mehta', feeType:'Hostel', amount:18000, status:'Overdue', dueDate:'2026-07-01', notes:'' },
];
let docStatusFilter = '';
let docSearchQ = '';
let expandedDocGroups = {};            // studentId -> bool, tracks which student's document list is expanded
let timetableEntries = [               // TODO: GET /timetable
  { id:'TT-1', course:'Computer Science', day:'Monday', start:'09:00', end:'10:00', subject:'Data Structures', room:'Room 204', faculty:'Dr. Sharma' },
  { id:'TT-2', course:'Computer Science', day:'Wednesday', start:'11:00', end:'12:00', subject:'Algorithms', room:'Room 204', faculty:'Dr. Sharma' },
];
let activityLogs = [];                 // TODO: GET /activity-log
let staffRoles = [                     // TODO: GET /staff
  { id:'STF-1', name:'Admin User', email:'admin@eduregportal.edu', role:'Admin', status:'Active', permissions:['students','fees','documents','notifications','analytics','staff'] },
];
let calendarEvents = [                 // TODO: GET /calendar-events
  { id:'EV-1', title:'Semester Fee Deadline', date:'2026-08-10', category:'Deadline', description:'Last date to clear semester tuition dues.' },
  { id:'EV-2', title:'Mid-Term Exams Begin', date:'2026-08-20', category:'Exam', description:'Mid-term exams for all courses begin.' },
];
let messageThreads = [];               // TODO: GET /messages
let activeThreadStudentId = null;

function logActivity(action, target){
  // TODO: POST /activity-log — for now this just keeps a local record for the Activity Log page.
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  activityLogs.unshift({
    id: 'LOG-' + Date.now(),
    actor: user?.name || 'Staff',
    action, target,
    timestamp: new Date().toISOString(),
  });
}

async function ensureStudentsCache(force=false){
  if(studentsCache.length && !force) return studentsCache;
  try {
    studentsCache = await StudentApi.getStudents({});
  } catch (err) {
    studentsCache = [];
  }
  return studentsCache;
}

function studentSelectOptions(students, selectedId=''){
  return `<option value="">Select student</option>` + students.map(s=>
    `<option value="${s.id}" ${s.id===selectedId?'selected':''}>${escapeHtml(s.firstName+' '+s.lastName)} · ${s.id}</option>`
  ).join('');
}

function downloadTextFile(filename, content, mime='text/csv'){
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

async function loadCourses(){
  try {
    const courses = await StudentApi.getCourses();
    if (Array.isArray(courses) && courses.length) {
      coursesCache = courses;
      COURSES_COLORS = courses.reduce((acc, c) => {
        acc[c.name] = [c.color_bg || '#f1f5f9', c.color_fg || '#475569'];
        return acc;
      }, {});
    }
  } catch (err) {
    showToast('Using saved course list until the server responds', 'info');
  }
  populateCourseSelect();
}

function populateCourseSelect(){
  const select = document.getElementById('fCourse');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Select Course</option>' +
    coursesCache.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  select.value = current;
}

// ===== NAVIGATION =====
function navigate(page){
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  const titles = {
    dashboard:['Dashboard','Overview of registrations'],
    students:['Students','Manage all student records'],
    courses:['Courses','Available programs'],
    attendance:['Attendance','Mark and review daily attendance'],
    timetable:['Timetable','Class schedules by course'],
    fees:['Fees & Payments','Track dues and payment history'],
    notifications:['Notifications','Send updates and alerts to students'],
    messages:['Messages','Direct conversations with students'],
    calendar:['Calendar','Academic dates and events'],
    documents:['Documents','Verify student-submitted documents'],
    analytics:['Analytics','Detailed statistics'],
    reports:['Reports','Generate downloadable reports'],
    activity:['Activity Log','Staff actions across the system'],
    import:['Bulk Import','Import many students at once'],
    roles:['Roles & Access','Manage staff accounts and permissions'],
    settings:['Settings','Configure system preferences'],
    help:['Help & Support','Guides and contact options'],
  };
  document.getElementById('pageTitle').textContent = titles[page][0];
  document.getElementById('pageSubtitle').textContent = titles[page][1];
  render();
}

// ===== RENDER PAGES =====
function render(){
  const c = document.getElementById('mainContent');
  c.innerHTML = '<div class="loading"><div class="spinner"></div> Loading...</div>';
  c.className = 'content fade-in';
  if(currentPage==='dashboard') renderDashboard(c);
  else if(currentPage==='students') renderStudents(c);
  else if(currentPage==='courses') renderCourses(c);
  else if(currentPage==='analytics') renderAnalytics(c);
  else if(currentPage==='notifications') renderNotifications(c);
  else if(currentPage==='attendance') renderAttendance(c);
  else if(currentPage==='timetable') renderTimetable(c);
  else if(currentPage==='fees') renderFees(c);
  else if(currentPage==='messages') renderMessages(c);
  else if(currentPage==='calendar') renderCalendar(c);
  else if(currentPage==='documents') renderDocuments(c);
  else if(currentPage==='reports') renderReports(c);
  else if(currentPage==='activity') renderActivity(c);
  else if(currentPage==='import') renderImport(c);
  else if(currentPage==='roles') renderRoles(c);
  else if(currentPage==='settings') renderSettings(c);
  else if(currentPage==='help') renderHelp(c);
}

// -- DASHBOARD --
async function renderDashboard(c){
  try {
    const stats = await StudentApi.getStats();
    const recent = stats.recent || [];
    const statusColors = {'Active':'#22c55e','Inactive':'#ef4444','Pending':'#f59e0b','Graduated':'#3b82f6'};
    const maxStatusCount = Math.max(...(stats.byStatus || []).map(s=>s.cnt), 1);

    c.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon blue">👥</div>
        <div>
          <div class="stat-value">${stats.total}</div>
          <div class="stat-label">Total Students</div>
          <div class="stat-trend trend-up">↑ Registered</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">✅</div>
        <div>
          <div class="stat-value">${stats.active}</div>
          <div class="stat-label">Active Students</div>
          <div class="stat-trend trend-up">↑ Currently enrolled</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon amber">🎓</div>
        <div>
          <div class="stat-value">${stats.graduated}</div>
          <div class="stat-label">Graduated</div>
          <div class="stat-trend trend-up">↑ Alumni</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red">⭐</div>
        <div>
          <div class="stat-value">${stats.avgGpa}</div>
          <div class="stat-label">Avg GPA</div>
          <div class="stat-trend" style="color:var(--info)">Out of 10.0</div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 320px;gap:1.5rem">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Recent Registrations</div>
          <button class="btn btn-secondary btn-sm" onclick="navigate('students')">View All →</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Course</th><th>GPA</th><th>Status</th><th>Joined</th></tr></thead>
            <tbody>
              ${recent.map(s=>`
              <tr onclick="viewStudent('${s.id}')" style="cursor:pointer">
                <td><div class="student-info">
                  <div class="student-avatar" style="background:${courseColor(s.course)[0]};color:${courseColor(s.course)[1]}">${initials(s)}</div>
                  <div><div class="student-name">${s.firstName} ${s.lastName}</div><div class="student-id">${s.id}</div></div>
                </div></td>
                <td><span class="course-tag" style="background:${courseColor(s.course)[0]};color:${courseColor(s.course)[1]}">${s.course}</span></td>
                <td><strong>${s.gpa||'—'}</strong></td>
                <td>${statusBadge(s.status)}</td>
                <td style="color:var(--text3);font-size:0.8rem">${formatDate(s.joined)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><div class="card-title">By Status</div></div>
        <div class="card-body">
          <div class="chart-bar-wrap">
            ${(stats.byStatus||[]).map(s=>{
              const pct = Math.round((s.cnt/maxStatusCount)*100);
              return `<div class="chart-bar-row">
                <div class="chart-bar-label">${s.status}</div>
                <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%;background:${statusColors[s.status]||'#3b82f6'}"></div></div>
                <div class="chart-bar-val">${s.cnt}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="card-header" style="margin-top:1rem"><div class="card-title">Pending Actions</div></div>
        <div class="card-body" style="padding-top:0.5rem">
          ${stats.pending>0?`<div style="background:#fffbeb;border-radius:var(--radius-sm);padding:12px;font-size:0.85rem;color:#92400e;display:flex;align-items:center;gap:8px">
            <span>⚠️</span><span><strong>${stats.pending}</strong> student(s) awaiting document verification</span>
          </div>`:'<div style="color:var(--text3);font-size:0.85rem;text-align:center;padding:12px">✅ No pending actions</div>'}
          ${stats.inactive>0?`<div style="background:#fef2f2;border-radius:var(--radius-sm);padding:12px;font-size:0.85rem;color:#991b1b;display:flex;align-items:center;gap:8px;margin-top:8px">
            <span>🔴</span><span><strong>${stats.inactive}</strong> student(s) currently inactive</span>
          </div>`:''}
        </div>
      </div>
    </div>`;
  } catch (err) {
    c.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Failed to load dashboard</div><p>${err.message}</p></div>`;
  }
}

// -- STUDENTS --
async function renderStudents(c){
  try {
    const params = new URLSearchParams();
    if(searchQ) params.set('search', searchQ);
    if(filterCourse) params.set('course', filterCourse);
    if(filterStatus) params.set('status', filterStatus);

    const students = await StudentApi.getStudents({
      search: searchQ,
      course: filterCourse,
      status: filterStatus,
    });
    const total = students.length;
    const totalPages = Math.ceil(total/PER_PAGE);
    currentPageNum = Math.min(currentPageNum, Math.max(1,totalPages));
    const paged = students.slice((currentPageNum-1)*PER_PAGE, currentPageNum*PER_PAGE);

    c.innerHTML = `
    <div class="toolbar">
      <div class="search-box">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Search students by name, ID, email…" value="${searchQ}" oninput="searchQ=this.value;currentPageNum=1;render()" id="searchInput">
      </div>
      <select onchange="filterCourse=this.value;currentPageNum=1;render()">
        <option value="">All Courses</option>
        ${coursesCache.map(c=>`<option value="${escapeHtml(c.name)}" ${filterCourse===c.name?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}
      </select>
      <select onchange="filterStatus=this.value;currentPageNum=1;render()">
        <option value="">All Status</option>
        <option ${filterStatus==='Active'?'selected':''}>Active</option>
        <option ${filterStatus==='Inactive'?'selected':''}>Inactive</option>
        <option ${filterStatus==='Pending'?'selected':''}>Pending</option>
        <option ${filterStatus==='Graduated'?'selected':''}>Graduated</option>
      </select>
      <div class="view-toggle">
        <button class="view-btn ${viewMode==='table'?'active':''}" onclick="viewMode='table';render()">☰ Table</button>
        <button class="view-btn ${viewMode==='grid'?'active':''}" onclick="viewMode='grid';render()">⊞ Grid</button>
      </div>
      <span style="font-size:0.8rem;color:var(--text3);margin-left:auto">${total} student${total!==1?'s':''} found</span>
    </div>
    <div class="card">
      ${paged.length===0?`<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">No students found</div><p>Try adjusting your filters</p></div>`
      : viewMode==='table' ? tableView(paged) : gridView(paged)}
    </div>
    ${totalPages>1?paginationHtml(totalPages):''}`;

    // Restore focus to the search input if it was active
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchQ) {
      searchInput.focus();
      searchInput.setSelectionRange(searchQ.length, searchQ.length);
    }
  } catch (err) {
    c.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Failed to load students</div><p>${err.message}</p></div>`;
  }
}

function tableView(paged){
  return `<div class="table-wrap"><table>
    <thead><tr>
      <th>Student</th><th>Course</th><th>Year</th><th>GPA</th><th>Status</th><th>Phone</th><th>Actions</th>
    </tr></thead>
    <tbody>
      ${paged.map(s=>`<tr>
        <td><div class="student-info">
          <div class="student-avatar" style="background:${courseColor(s.course)[0]};color:${courseColor(s.course)[1]}">${initials(s)}</div>
          <div><div class="student-name">${s.firstName} ${s.lastName}</div><div class="student-id">${s.id} · ${s.email}</div></div>
        </div></td>
        <td><span class="course-tag" style="background:${courseColor(s.course)[0]};color:${courseColor(s.course)[1]}">${s.course}</span></td>
        <td style="color:var(--text2);font-size:0.85rem">${s.year}</td>
        <td><strong style="color:${gpaColor(s.gpa)}">${s.gpa||'—'}</strong></td>
        <td>${statusBadge(s.status)}</td>
        <td style="color:var(--text2);font-size:0.82rem">${s.phone||'—'}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn-icon" title="View" onclick="viewStudent('${s.id}')">👁️</button>
            <button class="btn-icon" title="Notify" onclick="openSendNotificationModal({audience:'student', studentId:'${s.id}', studentLabel:'${escapeHtml(s.firstName+' '+s.lastName)}'})">🔔</button>
            <button class="btn-icon" title="Edit" onclick="openEditModal('${s.id}')">✏️</button>
            <button class="btn-icon" title="Delete" style="border-color:#fecaca" onclick="openDelete('${s.id}')">🗑️</button>
          </div>
        </td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

function gridView(paged){
  return `<div style="padding:1.25rem"><div class="students-grid">
    ${paged.map(s=>`<div class="student-card">
      <div class="student-card-avatar" style="background:${courseColor(s.course)[0]};color:${courseColor(s.course)[1]}">${initials(s)}</div>
      <div class="student-card-name">${s.firstName} ${s.lastName}</div>
      <div class="student-card-id">${s.id}</div>
      <div class="student-card-meta">${s.course} · ${s.year}</div>
      ${statusBadge(s.status)}
      <div style="margin-top:10px;font-size:0.82rem;color:var(--text3)">GPA: <strong style="color:${gpaColor(s.gpa)}">${s.gpa||'—'}</strong></div>
      <div class="student-card-actions" style="margin-top:12px">
        <button class="btn btn-secondary btn-sm" onclick="viewStudent('${s.id}')">View</button>
        <button class="btn btn-secondary btn-sm" onclick="openSendNotificationModal({audience:'student', studentId:'${s.id}', studentLabel:'${escapeHtml(s.firstName+' '+s.lastName)}'})">🔔</button>
        <button class="btn btn-primary btn-sm" onclick="openEditModal('${s.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="openDelete('${s.id}')">Del</button>
      </div>
    </div>`).join('')}
  </div></div>`;
}

function paginationHtml(totalPages){
  let html = '<div class="pagination">';
  html += `<button class="page-btn" onclick="currentPageNum=Math.max(1,currentPageNum-1);render()" ${currentPageNum===1?'disabled':''}>‹</button>`;
  for(let i=1;i<=totalPages;i++) html += `<button class="page-btn ${i===currentPageNum?'active':''}" onclick="currentPageNum=${i};render()">${i}</button>`;
  html += `<button class="page-btn" onclick="currentPageNum=Math.min(${totalPages},currentPageNum+1);render()" ${currentPageNum===totalPages?'disabled':''}">›</button>`;
  return html+'</div>';
}

// -- COURSES --
async function renderCourses(c){
  try {
    const courses = await StudentApi.getCourses();
    c.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.25rem">
      ${courses.map(course=>{
        const bg = course.color_bg || '#f1f5f9';
        const col = course.color_fg || '#475569';
        const activeC = course.activeCount || 0;
        const avgG = course.avgGpa || '—';
        const cnt = course.studentCount || 0;
        return `<div class="card" style="padding:1.5rem;transition:.2s;cursor:pointer" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform=''">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
            <div style="width:44px;height:44px;border-radius:var(--radius);background:${bg};display:flex;align-items:center;justify-content:center;font-size:1.2rem">📚</div>
            <span class="course-tag" style="background:${bg};color:${col}">${cnt} Students</span>
          </div>
          <div style="font-weight:600;font-size:0.95rem;margin-bottom:4px">${course.name}</div>
          <div style="font-size:0.78rem;color:var(--text3);margin-bottom:1rem">University Program</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:8px;text-align:center">
              <div style="font-size:1.1rem;font-weight:700;color:${col}">${activeC}</div>
              <div style="font-size:0.7rem;color:var(--text3)">Active</div>
            </div>
            <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:8px;text-align:center">
              <div style="font-size:1.1rem;font-weight:700;color:${col}">${avgG}</div>
              <div style="font-size:0.7rem;color:var(--text3)">Avg GPA</div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  } catch (err) {
    c.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Failed to load courses</div><p>${err.message}</p></div>`;
  }
}

// -- ANALYTICS --
async function renderAnalytics(c){
  try {
    const stats = await StudentApi.getAnalytics();
    const byYear = stats.byYear || [];
    const maxY = Math.max(...byYear.map(y=>y.cnt), 1);

    const gpaDist = stats.gpaDistribution || {};
    const gpaRanges = [['0–5',gpaDist['0-5']||0],['5–6',gpaDist['5-6']||0],['6–7',gpaDist['6-7']||0],['7–8',gpaDist['7-8']||0],['8–9',gpaDist['8-9']||0],['9–10',gpaDist['9-10']||0]];
    const maxG = Math.max(...gpaRanges.map(r=>r[1]), 1);

    const byGender = stats.byGender || [];
    const byStatus = stats.byStatus || [];
    const maxSt = Math.max(...byStatus.map(s=>s.cnt), 1);
    const statusColors = {'Active':'#22c55e','Inactive':'#ef4444','Pending':'#f59e0b','Graduated':'#3b82f6'};

    const top = stats.topPerformer;

    c.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon blue">📊</div><div><div class="stat-value">${stats.total}</div><div class="stat-label">Total Enrolled</div></div></div>
      <div class="stat-card"><div class="stat-icon green">📈</div><div><div class="stat-value">${stats.avgGpa}</div><div class="stat-label">Average GPA</div></div></div>
      <div class="stat-card"><div class="stat-icon amber">🏆</div><div><div class="stat-value">${stats.maxGpa}</div><div class="stat-label">Highest GPA</div></div></div>
      <div class="stat-card"><div class="stat-icon red">📚</div><div><div class="stat-value">${stats.totalCourses}</div><div class="stat-label">Total Courses</div></div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
      <div class="card">
        <div class="card-header"><div class="card-title">Students by Year</div></div>
        <div class="card-body">
          <div class="chart-bar-wrap">
            ${byYear.map(y=>`<div class="chart-bar-row">
              <div class="chart-bar-label" style="width:60px">${y.year}</div>
              <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.round((y.cnt/maxY)*100)}%;background:#3b82f6"></div></div>
              <div class="chart-bar-val">${y.cnt}</div>
            </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">GPA Distribution</div></div>
        <div class="card-body">
          <div class="chart-bar-wrap">
            ${gpaRanges.map(([range,cnt])=>`<div class="chart-bar-row">
              <div class="chart-bar-label" style="width:40px">${range}</div>
              <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.round((cnt/maxG)*100)}%;background:#22c55e"></div></div>
              <div class="chart-bar-val">${cnt}</div>
            </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Status Breakdown</div></div>
        <div class="card-body">
          <div class="chart-bar-wrap">
            ${byStatus.map(s=>{
              const pct = Math.round((s.cnt/maxSt)*100);
              return `<div class="chart-bar-row">
                <div class="chart-bar-label">${s.status}</div>
                <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%;background:${statusColors[s.status]||'#3b82f6'}"></div></div>
                <div class="chart-bar-val">${s.cnt}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Gender Distribution</div></div>
        <div class="card-body">
          <div class="chart-bar-wrap">
            ${byGender.map(g=>`<div class="chart-bar-row">
              <div class="chart-bar-label" style="width:55px">${g.gender}</div>
              <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.round((g.cnt/stats.total)*100)}%;background:#a855f7"></div></div>
              <div class="chart-bar-val">${g.cnt}</div>
            </div>`).join('')}
          </div>
          ${top?`<div style="margin-top:1rem">
            <div class="card" style="background:var(--surface2);border-radius:var(--radius);padding:12px">
              <div style="font-size:0.8rem;color:var(--text3);margin-bottom:8px">Top Performer</div>
              <div class="student-info">
                <div class="student-avatar" style="background:${courseColor(top.course)[0]};color:${courseColor(top.course)[1]}">${initials(top)}</div>
                <div><div class="student-name">${top.firstName} ${top.lastName}</div>
                <div class="student-id">GPA: ${top.gpa} · ${top.course}</div></div>
              </div>
            </div>
          </div>`:''}
        </div>
      </div>
    </div>`;
  } catch (err) {
    c.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Failed to load analytics</div><p>${err.message}</p></div>`;
  }
}

// ===== MODAL CRUD =====
function openAddModal(){
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Add New Student';
  clearForm();
  showModal('studentModal');
}

async function openEditModal(id){
  try {
    const s = await StudentApi.getStudent(id);
    editingId = id;
    document.getElementById('modalTitle').textContent = 'Edit Student';
    document.getElementById('fFirstName').value = s.firstName;
    document.getElementById('fLastName').value = s.lastName;
    document.getElementById('fEmail').value = s.email;
    document.getElementById('fPhone').value = s.phone||'';
    document.getElementById('fDob').value = s.dob||'';
    document.getElementById('fGender').value = s.gender||'';
    document.getElementById('fAddress').value = s.address||'';
    document.getElementById('fCourse').value = s.course;
    document.getElementById('fYear').value = s.year;
    document.getElementById('fGpa').value = s.gpa||'';
    document.getElementById('fStatus').value = s.status;
    document.getElementById('fNotes').value = s.notes||'';
    showModal('studentModal');
  } catch (err) {
    showToast('Failed to load student data', 'error');
  }
}

async function saveStudent(){
  const firstName = document.getElementById('fFirstName').value.trim();
  const lastName = document.getElementById('fLastName').value.trim();
  const email = document.getElementById('fEmail').value.trim();
  const course = document.getElementById('fCourse').value;
  if(!firstName||!lastName||!email||!course){
    showToast('Please fill in all required fields','error'); return;
  }
  if(!/^[^@]+@[^@]+\.[^@]+$/.test(email)){
    showToast('Please enter a valid email address','error'); return;
  }
  const gpaValue = document.getElementById('fGpa').value;
  const parsedGpa = gpaValue === '' ? null : Number(gpaValue);
  if (parsedGpa !== null && (!Number.isFinite(parsedGpa) || parsedGpa < 0 || parsedGpa > 10)) {
    showToast('GPA must be between 0 and 10', 'error'); return;
  }
  const data = {
    firstName, lastName, email,
    phone: document.getElementById('fPhone').value.trim(),
    dob: document.getElementById('fDob').value,
    gender: document.getElementById('fGender').value,
    address: document.getElementById('fAddress').value.trim(),
    course,
    year: document.getElementById('fYear').value,
    gpa: parsedGpa,
    status: document.getElementById('fStatus').value,
    notes: document.getElementById('fNotes').value.trim(),
  };

  try {
    if(editingId){
      await StudentApi.updateStudent(editingId, data);
      showToast('Student updated successfully','success');
    } else {
      await StudentApi.createStudent(data);
      showToast('Student registered successfully','success');
    }
    closeModal();
    render();
  } catch (err) {
    showToast(err.message || 'Failed to save student', 'error');
  }
}

async function viewStudent(id){
  try {
    const s = await StudentApi.getStudent(id);
    const [bg,col] = courseColor(s.course);
    document.getElementById('viewModalBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:1.5rem;padding-bottom:1.5rem;border-bottom:1px solid var(--border)">
      <div style="width:64px;height:64px;border-radius:50%;background:${bg};color:${col};display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:700;flex-shrink:0">${initials(s)}</div>
      <div>
        <div style="font-family:'Playfair Display',serif;font-size:1.3rem">${s.firstName} ${s.lastName}</div>
        <div style="color:var(--text3);font-size:0.82rem;margin-top:2px">${s.id} · Joined ${formatDate(s.joined)}</div>
        <div style="margin-top:8px">${statusBadge(s.status)}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
      ${[
        ['📧 Email', s.email],
        ['📱 Phone', s.phone||'—'],
        ['🎂 Date of Birth', s.dob?formatDate(s.dob):'—'],
        ['⚥ Gender', s.gender||'—'],
        ['📚 Course', s.course],
        ['🎓 Year', s.year],
        ['⭐ GPA', s.gpa||'—'],
        ['🏠 Address', s.address||'—'],
      ].map(([l,v])=>`<div style="background:var(--surface2);border-radius:var(--radius-sm);padding:12px">
        <div style="font-size:0.72rem;color:var(--text3);margin-bottom:4px">${l}</div>
        <div style="font-size:0.875rem;font-weight:500">${v}</div>
      </div>`).join('')}
      ${s.notes?`<div style="background:var(--surface2);border-radius:var(--radius-sm);padding:12px;grid-column:1/-1">
        <div style="font-size:0.72rem;color:var(--text3);margin-bottom:4px">📝 Notes</div>
        <div style="font-size:0.875rem">${s.notes}</div>
      </div>`:''}
    </div>
    <div style="margin-top:1.5rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:0.8rem;font-weight:600;color:var(--text2)">📁 Documents</div>
        <button class="btn btn-secondary btn-sm" onclick="closeOverlay('viewModal');openDocumentModal('${s.id}')">+ Upload</button>
      </div>
      <div id="studentDocsPanel" style="background:var(--surface2);border-radius:var(--radius-sm);padding:12px;font-size:0.8rem;color:var(--text3)">Loading documents…</div>
    </div>
    <div style="display:flex;gap:10px;margin-top:1.5rem">
      <button class="btn btn-primary" onclick="closeOverlay('viewModal');openEditModal('${s.id}')">✏️ Edit Student</button>
      <button class="btn btn-secondary" onclick="closeOverlay('viewModal');openSendNotificationModal({audience:'student', studentId:'${s.id}', studentLabel:'${escapeHtml(s.firstName+' '+s.lastName)}'})">🔔 Notify</button>
      <button class="btn btn-danger" onclick="closeOverlay('viewModal');openDelete('${s.id}')">🗑️ Delete</button>
    </div>`;
    showModal('viewModal');
    loadStudentDocsPanel(s.id);
  } catch (err) {
    showToast('Failed to load student profile', 'error');
  }
}

// Loads ALL documents for this student (however many there are) into their
// profile modal, each with its own verify/reject/delete controls — so a
// student who has submitted 12+ documents sees all 12+, not just one.
async function loadStudentDocsPanel(studentId){
  const panel = document.getElementById('studentDocsPanel');
  if(!panel) return;
  try {
    const docs = await DocumentsApi.getStudentDocuments(studentId);
    if(!docs.length){ panel.innerHTML = 'No documents uploaded yet.'; return; }
    panel.innerHTML = docs.map(d=>`
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1;min-width:0">
          <div style="font-size:0.85rem;font-weight:500;color:var(--text)">${d.fileUrl?`<a href="${d.fileUrl}" target="_blank" rel="noopener">${escapeHtml(d.docType)} ↗</a>`:escapeHtml(d.docType)}</div>
          <div style="font-size:0.72rem;color:var(--text3)">${formatDate(d.uploadedAt)}</div>
        </div>
        <span class="status doc-status-${d.status.toLowerCase().replace(/\s+/g,'-')}"><span class="status-dot"></span>${d.status}</span>
        <div style="display:flex;gap:6px">
          ${d.status!=='Verified'?`<button class="btn-icon" title="Verify" onclick="setDocumentStatus('${d.id}','Verified').then(()=>loadStudentDocsPanel('${studentId}'))">✅</button>`:''}
          ${d.status!=='Rejected'?`<button class="btn-icon" title="Reject" onclick="setDocumentStatus('${d.id}','Rejected').then(()=>loadStudentDocsPanel('${studentId}'))">❌</button>`:''}
        </div>
      </div>`).join('');
  } catch (err) {
    panel.innerHTML = 'Failed to load documents.';
  }
}

function openDelete(id){
  deleteId = id;
  showModal('confirmModal');
}
async function confirmDelete(){
  try {
    await StudentApi.deleteStudent(deleteId);
    closeConfirm();
    render();
    showToast('Student deleted successfully','info');
  } catch (err) {
    showToast('Failed to delete student', 'error');
    closeConfirm();
  }
}
function closeConfirm(){
  closeOverlay('confirmModal');
  deleteId = null;
}
function clearForm(){
  ['fFirstName','fLastName','fEmail','fPhone','fDob','fAddress','fGpa','fNotes'].forEach(id=>document.getElementById(id).value='');
  ['fGender','fCourse'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('fYear').value='1st Year';
  document.getElementById('fStatus').value='Active';
}
function showModal(id){
  const m = document.getElementById(id);
  m.style.display='flex';
  requestAnimationFrame(()=>m.classList.add('show'));
}
function closeModal(){
  closeOverlay('studentModal');
}
function closeOverlay(id){
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('show');
  setTimeout(()=>m.style.display='none',200);
}

function exportStudents(){
  StudentApi.exportStudentsCsv();
}

// ===== NOTIFICATIONS: SEND-TO-STUDENTS PAGE =====
async function renderNotifications(c){
  try {
    const notifs = await NotificationApi.getNotifications(notifTypeFilter ? {type: notifTypeFilter} : {});
    const list = Array.isArray(notifs) ? notifs : (notifs.items || []);
    const totalSent = list.length;
    const totalReached = list.reduce((sum,n)=>sum+(n.recipientCount||0),0);
    const weekAgo = Date.now() - 7*24*60*60*1000;
    const thisWeek = list.filter(n=>new Date(n.sentAt).getTime() >= weekAgo).length;
    const urgentCount = list.filter(n=>n.type==='urgent'||n.type==='warning').length;

    c.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon blue">📨</div><div><div class="stat-value">${totalSent}</div><div class="stat-label">Notifications Sent</div></div></div>
      <div class="stat-card"><div class="stat-icon green">👥</div><div><div class="stat-value">${totalReached}</div><div class="stat-label">Students Reached</div></div></div>
      <div class="stat-card"><div class="stat-icon amber">📅</div><div><div class="stat-value">${thisWeek}</div><div class="stat-label">Sent This Week</div></div></div>
      <div class="stat-card"><div class="stat-icon red">⚠️</div><div><div class="stat-value">${urgentCount}</div><div class="stat-label">Warnings / Urgent</div></div></div>
    </div>
    <div class="toolbar">
      <select onchange="notifTypeFilter=this.value;render()">
        <option value="">All Types</option>
        ${Object.entries(NOTIF_TYPES).map(([k,v])=>`<option value="${k}" ${notifTypeFilter===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}
      </select>
      <span style="font-size:0.8rem;color:var(--text3)">${list.length} notification${list.length!==1?'s':''}</span>
      <button class="btn btn-primary" style="margin-left:auto" onclick="openSendNotificationModal()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        Send Notification
      </button>
    </div>
    <div class="card">
      ${list.length===0 ? `<div class="empty-state"><div class="empty-icon">🔔</div><div class="empty-title">No notifications yet</div><p>Send your first update to students using the button above</p></div>`
      : list.slice().sort((a,b)=>new Date(b.sentAt)-new Date(a.sentAt)).map(n=>notifCardHtml(n)).join('')}
    </div>`;
  } catch (err) {
    c.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Failed to load notifications</div><p>${err.message}</p></div>`;
  }
}

function notifCardHtml(n){
  const meta = NOTIF_TYPES[n.type] || NOTIF_TYPES.info;
  const audienceLabel = audienceDescription(n);
  return `<div class="notif-card">
    <div class="notif-card-icon ${meta.cls}">${meta.icon}</div>
    <div class="notif-card-body">
      <div class="notif-card-top">
        <div class="notif-card-title">${escapeHtml(n.title)}</div>
        <span class="audience-chip">${audienceLabel}</span>
      </div>
      <div class="notif-card-msg">${escapeHtml(n.message)}</div>
      <div class="notif-card-meta">
        <span>🕒 ${formatDateTime(n.sentAt)}</span>
        <span>👥 ${n.recipientCount||0} recipient${(n.recipientCount||0)!==1?'s':''}</span>
        ${n.sentBy?`<span>👤 ${escapeHtml(n.sentBy)}</span>`:''}
      </div>
    </div>
    <div class="notif-card-actions">
      <button class="btn-icon" title="Resend" onclick="resendNotification('${n.id}')">🔁</button>
      <button class="btn-icon" title="Delete" style="border-color:#fecaca" onclick="deleteNotificationConfirm('${n.id}')">🗑️</button>
    </div>
  </div>`;
}

function audienceDescription(n){
  if(!n.audience) return 'All Students';
  const type = n.audience.type || n.audience;
  const value = n.audience.value || n.audienceValue;
  if(type==='all') return 'All Students';
  if(type==='course') return `Course: ${escapeHtml(value||'')}`;
  if(type==='status') return `Status: ${escapeHtml(value||'')}`;
  if(type==='student') return `👤 ${escapeHtml(n.studentName || value || 'Student')}`;
  return 'All Students';
}

// ---- Send Notification modal ----
function openSendNotificationModal(prefill = {}){
  document.getElementById('nTitle').value = '';
  document.getElementById('nMessage').value = '';
  document.getElementById('nType').value = 'info';
  document.getElementById('nAudience').value = prefill.audience || 'all';
  updateAudienceSubField(prefill);
  document.getElementById('notifyModalTitle').textContent =
    prefill.audience === 'student' ? `Notify ${prefill.studentLabel || 'Student'}` : 'Send Notification';
  showModal('notifyModal');
}

function updateAudienceSubField(prefill = {}){
  const audience = document.getElementById('nAudience').value;
  const subWrap = document.getElementById('nAudienceSubWrap');
  const subLabel = document.getElementById('nAudienceSubLabel');
  const subSelect = document.getElementById('nAudienceSub');
  const preview = document.getElementById('nAudiencePreview');

  if(audience === 'all'){
    subWrap.style.display = 'none';
    preview.innerHTML = '📢 This will notify <strong>all students</strong>.';
  } else if(audience === 'course'){
    subWrap.style.display = '';
    subLabel.textContent = 'Course';
    subSelect.innerHTML = coursesCache.map(c=>`<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
    preview.innerHTML = `📢 This will notify all students in <strong>${escapeHtml(subSelect.value||'')}</strong>.`;
    subSelect.onchange = ()=>{ preview.innerHTML = `📢 This will notify all students in <strong>${escapeHtml(subSelect.value)}</strong>.`; };
  } else if(audience === 'status'){
    subWrap.style.display = '';
    subLabel.textContent = 'Status';
    subSelect.innerHTML = ['Active','Inactive','Pending','Graduated'].map(s=>`<option value="${s}">${s}</option>`).join('');
    preview.innerHTML = `📢 This will notify all <strong>${subSelect.value}</strong> students.`;
    subSelect.onchange = ()=>{ preview.innerHTML = `📢 This will notify all <strong>${subSelect.value}</strong> students.`; };
  } else if(audience === 'student'){
    subWrap.style.display = '';
    subLabel.textContent = 'Student';
    if(prefill.studentId){
      subSelect.innerHTML = `<option value="${prefill.studentId}">${escapeHtml(prefill.studentLabel||prefill.studentId)}</option>`;
      preview.innerHTML = `📢 This will notify <strong>${escapeHtml(prefill.studentLabel||prefill.studentId)}</strong> only.`;
    } else {
      subSelect.innerHTML = `<option value="">Search a student from the Students page first</option>`;
      preview.innerHTML = `📢 Pick a student from the <strong>Students</strong> page and use the 🔔 button to notify them directly.`;
    }
  }
}

async function submitNotification(){
  const title = document.getElementById('nTitle').value.trim();
  const message = document.getElementById('nMessage').value.trim();
  const type = document.getElementById('nType').value;
  const audience = document.getElementById('nAudience').value;
  const subSelect = document.getElementById('nAudienceSub');
  const audienceValue = audience === 'all' ? null : subSelect.value;

  if(!title || !message){
    showToast('Please fill in the title and message', 'error'); return;
  }
  if(audience !== 'all' && !audienceValue){
    showToast('Please choose a recipient', 'error'); return;
  }

  const payload = {
    title, message, type,
    audience,
    audienceValue,
    studentId: audience === 'student' ? audienceValue : undefined,
  };

  try {
    await NotificationApi.sendNotification(payload);
    closeOverlay('notifyModal');
    showToast('Notification sent to students', 'success');
    if(currentPage === 'notifications') render();
    refreshNotifBell();
  } catch (err) {
    showToast(err.message || 'Failed to send notification', 'error');
  }
}

async function resendNotification(id){
  try {
    await NotificationApi.resendNotification(id);
    showToast('Notification resent', 'success');
    render();
  } catch (err) {
    showToast(err.message || 'Failed to resend notification', 'error');
  }
}

function deleteNotificationConfirm(id){
  if(!confirm('Delete this notification? This will not un-notify students who already received it.')) return;
  NotificationApi.deleteNotification(id)
    .then(()=>{ showToast('Notification deleted', 'info'); render(); refreshNotifBell(); })
    .catch(err=>showToast(err.message || 'Failed to delete notification', 'error'));
}

function formatDateTime(d){
  if(!d) return '—';
  try {
    return new Date(d).toLocaleString('en-IN', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
  } catch { return d; }
}

// ---- Notification bell (system alerts + recent sends) ----
async function refreshNotifBell(){
  const list = document.getElementById('notifDropdownList');
  try {
    const [stats, sent] = await Promise.all([
      StudentApi.getStats().catch(()=>null),
      NotificationApi.getNotifications({limit: 5}).catch(()=>[]),
    ]);
    const sentList = Array.isArray(sent) ? sent : (sent?.items || []);

    const alerts = [];
    if(stats){
      if(stats.pending > 0 && !dismissedAlertKeys.includes('pending')){
        alerts.push({key:'pending', icon:'⚠️', cls:'notif-type-warning', title:'Pending verifications', text:`${stats.pending} student(s) awaiting document verification`});
      }
      if(stats.inactive > 0 && !dismissedAlertKeys.includes('inactive')){
        alerts.push({key:'inactive', icon:'🔴', cls:'notif-type-urgent', title:'Inactive students', text:`${stats.inactive} student(s) are currently inactive`});
      }
    }

    const badgeCount = alerts.length;
    const badge = document.getElementById('notifBadge');
    const navBadge = document.getElementById('navNotifBadge');
    [badge, navBadge].forEach(b=>{
      if(!b) return;
      if(badgeCount>0){ b.style.display='flex'; b.textContent = badgeCount>9?'9+':badgeCount; }
      else b.style.display='none';
    });

    if(!list) return;
    const alertsHtml = alerts.map(a=>`<div class="notif-dropdown-item">
      <div class="notif-dot-icon ${a.cls}">${a.icon}</div>
      <div><div class="notif-item-title">${a.title}</div><div class="notif-item-text">${a.text}</div></div>
    </div>`).join('');

    const sentHtml = sentList.slice(0,5).map(n=>{
      const meta = NOTIF_TYPES[n.type] || NOTIF_TYPES.info;
      return `<div class="notif-dropdown-item">
        <div class="notif-dot-icon ${meta.cls}">${meta.icon}</div>
        <div><div class="notif-item-title">${escapeHtml(n.title)}</div>
        <div class="notif-item-text">${escapeHtml((n.message||'').slice(0,70))}${(n.message||'').length>70?'…':''}</div>
        <div class="notif-item-time">Sent to ${audienceDescription(n)} · ${formatDateTime(n.sentAt)}</div></div>
      </div>`;
    }).join('');

    list.innerHTML = (alertsHtml + sentHtml) || `<div class="notif-empty">🔔 You're all caught up. No alerts right now.</div>`;
  } catch (err) {
    list.innerHTML = `<div class="notif-empty">Couldn't load notifications.</div>`;
  }
}

function toggleNotifDropdown(){
  const dd = document.getElementById('notifDropdown');
  const showing = dd.classList.contains('show');
  if(showing){ closeNotifDropdown(); return; }
  dd.classList.add('show');
  refreshNotifBell();
}
function closeNotifDropdown(){
  document.getElementById('notifDropdown')?.classList.remove('show');
}
function dismissAllAlerts(){
  dismissedAlertKeys = ['pending','inactive'];
  localStorage.setItem('eduregDismissedAlerts', JSON.stringify(dismissedAlertKeys));
  refreshNotifBell();
  showToast('Alerts cleared', 'info');
}
document.addEventListener('click', (e)=>{
  const wrap = document.querySelector('.notif-bell-wrap');
  if(wrap && !wrap.contains(e.target)) closeNotifDropdown();
});

// ===== ATTENDANCE =====
async function renderAttendance(c){
  const totalSessions = attendanceRecords.length;
  const avgPresent = totalSessions ? Math.round(attendanceRecords.reduce((s,r)=>s+r.presentPct,0)/totalSessions) : 0;
  const lowAttendance = attendanceRecords.filter(r=>r.presentPct < 75).length;

  c.innerHTML = `
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-icon blue">🗓️</div><div><div class="stat-value">${totalSessions}</div><div class="stat-label">Sessions Recorded</div></div></div>
    <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value">${avgPresent}%</div><div class="stat-label">Avg. Attendance</div></div></div>
    <div class="stat-card"><div class="stat-icon amber">⚠️</div><div><div class="stat-value">${lowAttendance}</div><div class="stat-label">Sessions Below 75%</div></div></div>
    <div class="stat-card"><div class="stat-icon red">📚</div><div><div class="stat-value">${coursesCache.length}</div><div class="stat-label">Courses Tracked</div></div></div>
  </div>
  <div class="toolbar">
    <span style="font-size:0.8rem;color:var(--text3)">${totalSessions} attendance record${totalSessions!==1?'s':''}</span>
    <button class="btn btn-primary" style="margin-left:auto" onclick="openAttendanceModal()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      Mark Attendance
    </button>
  </div>
  <div class="card">
    ${attendanceRecords.length===0 ? `<div class="empty-state"><div class="empty-icon">🗓️</div><div class="empty-title">No attendance marked yet</div><p>Use "Mark Attendance" to record a session</p></div>` : `
    <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Course</th><th>Present</th><th>Absent</th><th>Late</th><th>Attendance %</th><th></th></tr></thead>
      <tbody>${attendanceRecords.map(r=>`<tr>
        <td>${formatDate(r.date)}</td>
        <td><span class="course-tag" style="background:${courseColor(r.course)[0]};color:${courseColor(r.course)[1]}">${r.course}</span></td>
        <td>${r.present}</td><td>${r.absent}</td><td>${r.late}</td>
        <td><strong style="color:${r.presentPct>=75?'#16a34a':'#dc2626'}">${r.presentPct}%</strong></td>
        <td><button class="btn-icon" title="Delete" onclick="deleteAttendanceRecord('${r.id}')">🗑️</button></td>
      </tr>`).join('')}</tbody>
    </table></div>`}
  </div>`;
}

async function openAttendanceModal(){
  const courseSel = document.getElementById('attCourse');
  courseSel.innerHTML = coursesCache.map(c=>`<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  document.getElementById('attDate').value = new Date().toISOString().slice(0,10);
  courseSel.onchange = loadAttendanceStudentList;
  await loadAttendanceStudentList();
  showModal('attendanceModal');
}

async function loadAttendanceStudentList(){
  const wrap = document.getElementById('attStudentList');
  wrap.innerHTML = `<div class="loading" style="padding:1rem"><div class="spinner"></div></div>`;
  const course = document.getElementById('attCourse').value;
  await ensureStudentsCache();
  const students = studentsCache.filter(s=>s.course===course);
  if(!students.length){
    wrap.innerHTML = `<div class="tt-empty">No students found in this course</div>`;
    return;
  }
  wrap.innerHTML = students.map(s=>`
    <div class="att-row" data-student-id="${s.id}">
      <span>${escapeHtml(s.firstName+' '+s.lastName)}</span>
      <div class="att-choice">
        <button type="button" class="att-btn present active" onclick="setAttChoice('${s.id}','present',this)">Present</button>
        <button type="button" class="att-btn late" onclick="setAttChoice('${s.id}','late',this)">Late</button>
        <button type="button" class="att-btn absent" onclick="setAttChoice('${s.id}','absent',this)">Absent</button>
      </div>
    </div>`).join('');
}

function setAttChoice(studentId, choice, btnEl){
  const row = btnEl.closest('.att-row');
  row.querySelectorAll('.att-btn').forEach(b=>b.classList.remove('active'));
  btnEl.classList.add('active');
  row.dataset.choice = choice;
}

function submitAttendance(){
  const course = document.getElementById('attCourse').value;
  const date = document.getElementById('attDate').value;
  if(!course || !date){ showToast('Please choose a course and date','error'); return; }
  const rows = Array.from(document.querySelectorAll('#attStudentList .att-row'));
  if(!rows.length){ showToast('No students to mark for this course','error'); return; }
  let present=0, absent=0, late=0;
  rows.forEach(r=>{
    const choice = r.dataset.choice || 'present';
    if(choice==='present') present++; else if(choice==='late') late++; else absent++;
  });
  const total = rows.length;
  const presentPct = Math.round(((present+late)/total)*100);

  // TODO: replace with await AttendanceApi.markAttendance({ course, date, records })
  attendanceRecords.unshift({ id:'ATT-'+Date.now(), course, date, present, absent, late, presentPct });
  logActivity('Marked attendance', `${course} · ${formatDate(date)}`);
  closeOverlay('attendanceModal');
  showToast('Attendance saved', 'success');
  render();
}

function deleteAttendanceRecord(id){
  if(!confirm('Delete this attendance record?')) return;
  attendanceRecords = attendanceRecords.filter(r=>r.id!==id);
  logActivity('Deleted attendance record', id);
  showToast('Attendance record deleted','info');
  render();
}

// ===== FEES & PAYMENTS =====
let feeStatusFilter = '';
function renderFees(c){
  const filtered = feeStatusFilter ? feeRecords.filter(f=>f.status===feeStatusFilter) : feeRecords;
  const totalCollected = feeRecords.filter(f=>f.status==='Paid').reduce((s,f)=>s+Number(f.amount||0),0);
  const totalPending = feeRecords.filter(f=>f.status!=='Paid').reduce((s,f)=>s+Number(f.amount||0),0);
  const overdueCount = feeRecords.filter(f=>f.status==='Overdue').length;

  c.innerHTML = `
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-icon green">💰</div><div><div class="stat-value">₹${totalCollected.toLocaleString('en-IN')}</div><div class="stat-label">Total Collected</div></div></div>
    <div class="stat-card"><div class="stat-icon amber">⏳</div><div><div class="stat-value">₹${totalPending.toLocaleString('en-IN')}</div><div class="stat-label">Pending Dues</div></div></div>
    <div class="stat-card"><div class="stat-icon red">🚨</div><div><div class="stat-value">${overdueCount}</div><div class="stat-label">Overdue Accounts</div></div></div>
    <div class="stat-card"><div class="stat-icon blue">🧾</div><div><div class="stat-value">${feeRecords.length}</div><div class="stat-label">Total Records</div></div></div>
  </div>
  <div class="toolbar">
    <select onchange="feeStatusFilter=this.value;render()">
      <option value="">All Statuses</option>
      ${['Paid','Partial','Unpaid','Overdue'].map(s=>`<option ${feeStatusFilter===s?'selected':''}>${s}</option>`).join('')}
    </select>
    <span style="font-size:0.8rem;color:var(--text3)">${filtered.length} record${filtered.length!==1?'s':''}</span>
    <button class="btn btn-primary" style="margin-left:auto" onclick="openFeeModal()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Record Payment
    </button>
  </div>
  <div class="card">
    ${filtered.length===0 ? `<div class="empty-state"><div class="empty-icon">💳</div><div class="empty-title">No fee records</div><p>Record a payment to get started</p></div>` : `
    <div class="table-wrap"><table>
      <thead><tr><th>Student</th><th>Type</th><th>Amount</th><th>Status</th><th>Due Date</th><th></th></tr></thead>
      <tbody>${filtered.map(f=>`<tr>
        <td>${escapeHtml(f.studentName)}</td>
        <td>${f.feeType}</td>
        <td>₹${Number(f.amount||0).toLocaleString('en-IN')}</td>
        <td><span class="status fee-status-${f.status.toLowerCase()}"><span class="status-dot"></span>${f.status}</span></td>
        <td style="color:var(--text3);font-size:0.8rem">${f.dueDate?formatDate(f.dueDate):'—'}</td>
        <td><div style="display:flex;gap:6px">
          <button class="btn-icon" title="Edit" onclick="openFeeModal('${f.id}')">✏️</button>
          <button class="btn-icon" title="Delete" style="border-color:#fecaca" onclick="deleteFeeRecord('${f.id}')">🗑️</button>
        </div></td>
      </tr>`).join('')}</tbody>
    </table></div>`}
  </div>`;
}

async function openFeeModal(id){
  await ensureStudentsCache();
  const sel = document.getElementById('feeStudent');
  const existing = id ? feeRecords.find(f=>f.id===id) : null;
  sel.innerHTML = studentSelectOptions(studentsCache, existing?.studentId);
  document.getElementById('feeModalTitle').textContent = existing ? 'Edit Payment Record' : 'Record Payment';
  document.getElementById('feeType').value = existing?.feeType || 'Tuition';
  document.getElementById('feeAmount').value = existing?.amount || '';
  document.getElementById('feeStatus').value = existing?.status || 'Paid';
  document.getElementById('feeDueDate').value = existing?.dueDate || '';
  document.getElementById('feeNotes').value = existing?.notes || '';
  document.getElementById('feeModal').dataset.editingId = id || '';
  showModal('feeModal');
}

function submitFee(){
  const studentSel = document.getElementById('feeStudent');
  const studentId = studentSel.value;
  const studentName = studentSel.selectedOptions[0]?.textContent || '';
  const amount = Number(document.getElementById('feeAmount').value);
  if(!studentId || !amount){ showToast('Please select a student and enter an amount','error'); return; }

  const payload = {
    studentId, studentName,
    feeType: document.getElementById('feeType').value,
    amount,
    status: document.getElementById('feeStatus').value,
    dueDate: document.getElementById('feeDueDate').value,
    notes: document.getElementById('feeNotes').value.trim(),
  };
  const editingId = document.getElementById('feeModal').dataset.editingId;

  // TODO: replace with await FeesApi.createRecord(payload) / FeesApi.updateRecord(editingId, payload)
  if(editingId){
    const idx = feeRecords.findIndex(f=>f.id===editingId);
    if(idx>-1) feeRecords[idx] = {...feeRecords[idx], ...payload};
    logActivity('Updated fee record', studentName);
  } else {
    feeRecords.unshift({ id:'FEE-'+Date.now(), ...payload });
    logActivity('Recorded payment', `${studentName} · ₹${amount}`);
  }
  closeOverlay('feeModal');
  showToast('Fee record saved','success');
  render();
}

function deleteFeeRecord(id){
  if(!confirm('Delete this fee record?')) return;
  feeRecords = feeRecords.filter(f=>f.id!==id);
  logActivity('Deleted fee record', id);
  showToast('Fee record deleted','info');
  render();
}

// ===== DOCUMENTS / VERIFICATION =====
// A student can submit many documents (ID proof, 10th/12th marksheets, TC,
// migration certificate, photo, re-uploads after rejection, etc). So instead
// of one "document" slot per student, documents are their own list fetched
// from DocumentsApi and grouped by student here in the UI — a student with
// 12+ documents just gets a longer (scrollable) list under their name,
// nothing gets hidden or overwritten.
async function renderDocuments(c){
  try {
    const docs = await DocumentsApi.getDocuments(docStatusFilter ? {status: docStatusFilter} : {});
    const verified = docs.filter(d=>d.status==='Verified').length;
    const pending = docs.filter(d=>d.status==='Pending Review').length;
    const rejected = docs.filter(d=>d.status==='Rejected').length;

    let groups = groupDocumentsByStudent(docs);
    if (docSearchQ) {
      const q = docSearchQ.toLowerCase();
      groups = groups.filter(g => g.studentName.toLowerCase().includes(q) || (g.studentId||'').toLowerCase().includes(q));
    }
    groups.sort((a,b)=> b.docs.length - a.docs.length);

    c.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon blue">📄</div><div><div class="stat-value">${docs.length}</div><div class="stat-label">Total Documents</div></div></div>
      <div class="stat-card"><div class="stat-icon green">✅</div><div><div class="stat-value">${verified}</div><div class="stat-label">Verified</div></div></div>
      <div class="stat-card"><div class="stat-icon amber">⏳</div><div><div class="stat-value">${pending}</div><div class="stat-label">Pending Review</div></div></div>
      <div class="stat-card"><div class="stat-icon red">❌</div><div><div class="stat-value">${rejected}</div><div class="stat-label">Rejected</div></div></div>
    </div>
    <div class="toolbar">
      <div class="search-box">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Search by student name or ID…" value="${escapeHtml(docSearchQ)}" oninput="docSearchQ=this.value;render()">
      </div>
      <select onchange="docStatusFilter=this.value;render()">
        <option value="">All Statuses</option>
        ${['Pending Review','Verified','Rejected'].map(s=>`<option ${docStatusFilter===s?'selected':''}>${s}</option>`).join('')}
      </select>
      <span style="font-size:0.8rem;color:var(--text3)">${groups.length} student${groups.length!==1?'s':''} · ${docs.length} document${docs.length!==1?'s':''}</span>
      <button class="btn btn-primary" style="margin-left:auto" onclick="openDocumentModal()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Upload Document
      </button>
    </div>
    <div class="card" style="padding:0">
      ${groups.length===0 ? `<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-title">No documents</div><p>Upload a student document to begin verification</p></div>`
      : groups.map(g => renderDocGroup(g)).join('')}
    </div>`;
  } catch (err) {
    c.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Failed to load documents</div><p>${err.message}</p></div>`;
  }
}

function groupDocumentsByStudent(docs){
  const map = new Map();
  docs.forEach(d=>{
    const key = d.studentId || d.studentName;
    if(!map.has(key)) map.set(key, { studentId: d.studentId, studentName: d.studentName, docs: [] });
    map.get(key).docs.push(d);
  });
  return Array.from(map.values());
}

function docInitials(name){
  return (name||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
}

function renderDocGroup(g){
  const key = g.studentId || g.studentName;
  const isOpen = !!expandedDocGroups[key];
  const verified = g.docs.filter(d=>d.status==='Verified').length;
  const pending = g.docs.filter(d=>d.status==='Pending Review').length;
  const rejected = g.docs.filter(d=>d.status==='Rejected').length;
  return `
  <div class="doc-group" style="border-bottom:1px solid var(--border)">
    <div style="display:flex;align-items:center;gap:12px;padding:14px 20px;cursor:pointer" onclick="toggleDocGroup('${key}')">
      <span style="font-size:0.75rem;color:var(--text3);width:12px">${isOpen?'▾':'▸'}</span>
      <div style="width:36px;height:36px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:0.75rem;color:var(--text2);flex-shrink:0">${docInitials(g.studentName)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:0.9rem">${escapeHtml(g.studentName)}</div>
        <div style="font-size:0.75rem;color:var(--text3)">${g.studentId||'—'} · ${g.docs.length} document${g.docs.length!==1?'s':''}</div>
      </div>
      <div style="display:flex;gap:6px;font-size:0.75rem">
        ${verified?`<span class="status doc-status-verified"><span class="status-dot"></span>${verified}</span>`:''}
        ${pending?`<span class="status doc-status-pending-review"><span class="status-dot"></span>${pending}</span>`:''}
        ${rejected?`<span class="status doc-status-rejected"><span class="status-dot"></span>${rejected}</span>`:''}
      </div>
    </div>
    ${isOpen?`
    <div class="table-wrap" style="max-height:340px;overflow-y:auto;padding:0 20px 14px">
      <table>
        <thead><tr><th>Document</th><th>Uploaded</th><th>Status</th><th></th></tr></thead>
        <tbody>${g.docs.map(d=>`<tr>
          <td>${d.fileUrl?`<a href="${d.fileUrl}" target="_blank" rel="noopener">${escapeHtml(d.docType)} ↗</a>`:escapeHtml(d.docType)}</td>
          <td style="color:var(--text3);font-size:0.8rem">${formatDate(d.uploadedAt)}</td>
          <td><span class="status doc-status-${d.status.toLowerCase().replace(/\s+/g,'-')}"><span class="status-dot"></span>${d.status}</span></td>
          <td><div style="display:flex;gap:6px">
            ${d.status!=='Verified'?`<button class="btn-icon" title="Verify" onclick="event.stopPropagation();setDocumentStatus('${d.id}','Verified')">✅</button>`:''}
            ${d.status!=='Rejected'?`<button class="btn-icon" title="Reject" onclick="event.stopPropagation();setDocumentStatus('${d.id}','Rejected')">❌</button>`:''}
            <button class="btn-icon" title="Delete" style="border-color:#fecaca" onclick="event.stopPropagation();deleteDocumentRecord('${d.id}')">🗑️</button>
          </div></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`:''}
  </div>`;
}

function toggleDocGroup(key){
  expandedDocGroups[key] = !expandedDocGroups[key];
  render();
}

async function openDocumentModal(prefilledStudentId){
  await ensureStudentsCache();
  document.getElementById('docStudent').innerHTML = studentSelectOptions(studentsCache, prefilledStudentId||'');
  document.getElementById('docType').value = 'ID Proof';
  document.getElementById('docStatus').value = 'Pending Review';
  document.getElementById('docFileLabel').textContent = '📄 Click to choose a file';
  document.getElementById('docFileInput').value = '';
  showModal('documentModal');
}

async function submitDocument(){
  const sel = document.getElementById('docStudent');
  const studentId = sel.value;
  const studentName = sel.selectedOptions[0]?.textContent || '';
  if(!studentId){ showToast('Please select a student','error'); return; }

  const file = document.getElementById('docFileInput').files[0];
  if(!file){ showToast('Please choose a file to upload','error'); return; }

  const docType = document.getElementById('docType').value;
  const status = document.getElementById('docStatus').value;

  try {
    await DocumentsApi.uploadDocument(studentId, { file, docType, status });
    logActivity('Uploaded document', `${docType} · ${studentName}`);
    closeOverlay('documentModal');
    showToast('Document uploaded','success');
    render();
  } catch (err) {
    showToast(err.message || 'Failed to upload document', 'error');
  }
}

async function setDocumentStatus(id, status){
  try {
    await DocumentsApi.updateDocumentStatus(id, status);
    logActivity(`Marked document ${status.toLowerCase()}`, id);
    showToast(`Document marked ${status}`, status==='Rejected'?'error':'success');
    render();
  } catch (err) {
    showToast('Failed to update document status', 'error');
  }
}

async function deleteDocumentRecord(id){
  if(!confirm('Delete this document record?')) return;
  try {
    await DocumentsApi.deleteDocument(id);
    logActivity('Deleted document record', id);
    showToast('Document deleted','info');
    render();
  } catch (err) {
    showToast('Failed to delete document', 'error');
  }
}

// ===== TIMETABLE =====
let timetableCourseFilter = '';
function renderTimetable(c){
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const filtered = timetableCourseFilter ? timetableEntries.filter(t=>t.course===timetableCourseFilter) : timetableEntries;

  c.innerHTML = `
  <div class="toolbar">
    <select onchange="timetableCourseFilter=this.value;render()">
      <option value="">All Courses</option>
      ${coursesCache.map(c=>`<option value="${escapeHtml(c.name)}" ${timetableCourseFilter===c.name?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}
    </select>
    <span style="font-size:0.8rem;color:var(--text3)">${filtered.length} class${filtered.length!==1?'es':''} scheduled</span>
    <button class="btn btn-primary" style="margin-left:auto" onclick="openTimetableModal()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Entry
    </button>
  </div>
  <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:0.75rem">
    ${days.map(day=>{
      const slots = filtered.filter(t=>t.day===day).sort((a,b)=>a.start.localeCompare(b.start));
      return `<div class="tt-day-col">
        <div class="tt-day-head">${day.slice(0,3)}</div>
        ${slots.length===0 ? `<div class="tt-empty">No classes</div>` : slots.map(t=>`
          <div class="tt-slot">
            <div class="tt-slot-time">${t.start}–${t.end}</div>
            <div class="tt-slot-subject">${escapeHtml(t.subject)}</div>
            <div class="tt-slot-meta">${t.room||'—'}${t.faculty?' · '+escapeHtml(t.faculty):''}</div>
            <div style="margin-top:6px"><button class="btn-icon" style="width:24px;height:24px;padding:0" title="Remove" onclick="deleteTimetableEntry('${t.id}')">🗑️</button></div>
          </div>`).join('')}
      </div>`;
    }).join('')}
  </div>`;
}

function openTimetableModal(){
  document.getElementById('ttCourse').innerHTML = coursesCache.map(c=>`<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  ['ttStart','ttEnd','ttSubject','ttRoom','ttFaculty'].forEach(id=>document.getElementById(id).value='');
  showModal('timetableModal');
}

function submitTimetable(){
  const course = document.getElementById('ttCourse').value;
  const day = document.getElementById('ttDay').value;
  const start = document.getElementById('ttStart').value;
  const end = document.getElementById('ttEnd').value;
  const subject = document.getElementById('ttSubject').value.trim();
  if(!course || !start || !end || !subject){ showToast('Please fill in all required fields','error'); return; }

  // TODO: replace with await TimetableApi.createEntry(payload)
  timetableEntries.push({
    id: 'TT-'+Date.now(), course, day, start, end, subject,
    room: document.getElementById('ttRoom').value.trim(),
    faculty: document.getElementById('ttFaculty').value.trim(),
  });
  logActivity('Added timetable entry', `${subject} · ${course} · ${day}`);
  closeOverlay('timetableModal');
  showToast('Timetable entry added','success');
  render();
}

function deleteTimetableEntry(id){
  if(!confirm('Remove this class from the timetable?')) return;
  timetableEntries = timetableEntries.filter(t=>t.id!==id);
  logActivity('Removed timetable entry', id);
  showToast('Entry removed','info');
  render();
}

// ===== BULK IMPORT =====
let parsedImportRows = [];
function renderImport(c){
  c.innerHTML = `
  <div class="card" style="padding:1.5rem;margin-bottom:1.5rem">
    <div class="card-title" style="margin-bottom:8px">Import Students in Bulk</div>
    <p style="color:var(--text2);font-size:0.88rem;line-height:1.6">
      Upload a CSV file to preview and register many students at once, instead of adding them one by one.
      Expected columns: <code>firstName, lastName, email, phone, course, year, gpa, status</code>.
    </p>
    <div style="display:flex;gap:10px;margin-top:1rem">
      <button class="btn btn-primary" onclick="document.getElementById('importFileInput').click();openOverlayOnly('importModal')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Import from CSV
      </button>
      <button class="btn btn-secondary" onclick="downloadTextFile('student_import_template.csv','firstName,lastName,email,phone,course,year,gpa,status\\n')">
        Download Template
      </button>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">Recent Imports</div></div>
    <div class="empty-state" style="padding:2rem">
      <div class="empty-icon">📁</div>
      <div class="empty-title">No imports yet</div>
      <p>Import history will appear here once you run your first bulk import</p>
    </div>
  </div>`;
}

function openOverlayOnly(id){ showModal(id); }

function handleImportFileChosen(input){
  const file = input.files[0];
  if(!file) return;
  document.getElementById('importFileLabel').textContent = '📁 ' + file.name;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || '');
    const lines = text.split(/\r?\n/).filter(l=>l.trim());
    const headers = (lines[0]||'').split(',').map(h=>h.trim());
    parsedImportRows = lines.slice(1,6).map(line=>{
      const cols = line.split(',');
      const row = {};
      headers.forEach((h,i)=>row[h]=cols[i]?.trim());
      return row;
    });
    const previewWrap = document.getElementById('importPreviewWrap');
    const previewBody = document.getElementById('importPreviewBody');
    previewWrap.style.display = '';
    previewBody.innerHTML = `Found <strong>${lines.length-1}</strong> row(s). Showing first ${parsedImportRows.length}:<br><br>` +
      `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>` +
      `<tbody>${parsedImportRows.map(r=>`<tr>${headers.map(h=>`<td>${escapeHtml(r[h]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  };
  reader.readAsText(file);
}

function submitImport(){
  if(!parsedImportRows.length){ showToast('Choose a CSV file to preview first','error'); return; }
  // TODO: replace with a real bulk-create call, e.g.
  //   await StudentApi.bulkCreateStudents(parsedRows)
  // For now this just confirms what would be imported, since no backend endpoint exists yet.
  logActivity('Bulk import (preview only)', `${parsedImportRows.length} row(s) previewed`);
  showToast(`Preview ready for ${parsedImportRows.length} row(s) — connect a backend endpoint to actually create them`, 'info');
  closeOverlay('importModal');
}

// ===== ROLES & ACCESS =====
const PERMISSION_OPTIONS = [
  ['students','Manage Students'], ['fees','Manage Fees'], ['documents','Verify Documents'],
  ['notifications','Send Notifications'], ['analytics','View Analytics'], ['staff','Manage Staff'],
];
function renderRoles(c){
  c.innerHTML = `
  <div class="toolbar">
    <span style="font-size:0.8rem;color:var(--text3)">${staffRoles.length} staff member${staffRoles.length!==1?'s':''}</span>
    <button class="btn btn-primary" style="margin-left:auto" onclick="openRoleModal()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Staff Member
    </button>
  </div>
  <div class="card">
    ${staffRoles.map(r=>`<div class="role-card">
      <div class="avatar" style="background:var(--accent2)">${initialsFromName(r.name)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:0.9rem">${escapeHtml(r.name)}</div>
        <div style="font-size:0.78rem;color:var(--text3)">${escapeHtml(r.email)}</div>
      </div>
      <span class="role-pill">${r.role}</span>
      ${statusBadge(r.status==='Active'?'Active':(r.status==='Invited'?'Pending':'Inactive'))}
      <div style="display:flex;gap:6px">
        <button class="btn-icon" title="Edit" onclick="openRoleModal('${r.id}')">✏️</button>
        <button class="btn-icon" title="Remove" style="border-color:#fecaca" onclick="deleteRole('${r.id}')">🗑️</button>
      </div>
    </div>`).join('')}
  </div>`;
}

function openRoleModal(id){
  const existing = id ? staffRoles.find(r=>r.id===id) : null;
  document.getElementById('roleModalTitle').textContent = existing ? 'Edit Staff Member' : 'Add Staff Member';
  document.getElementById('roleName').value = existing?.name || '';
  document.getElementById('roleEmail').value = existing?.email || '';
  document.getElementById('roleType').value = existing?.role || 'Registrar';
  document.getElementById('roleStatus').value = existing?.status || 'Invited';
  const perms = existing?.permissions || [];
  document.getElementById('rolePermsWrap').innerHTML = PERMISSION_OPTIONS.map(([key,label])=>`
    <label style="display:flex;align-items:center;gap:8px;text-transform:none;font-weight:400;font-size:0.85rem;color:var(--text)">
      <input type="checkbox" value="${key}" ${perms.includes(key)?'checked':''} style="width:auto"> ${label}
    </label>`).join('');
  document.getElementById('roleModal').dataset.editingId = id || '';
  showModal('roleModal');
}

function submitRole(){
  const name = document.getElementById('roleName').value.trim();
  const email = document.getElementById('roleEmail').value.trim();
  if(!name || !email){ showToast('Please fill in name and email','error'); return; }
  const permissions = Array.from(document.querySelectorAll('#rolePermsWrap input:checked')).map(i=>i.value);
  const payload = {
    name, email,
    role: document.getElementById('roleType').value,
    status: document.getElementById('roleStatus').value,
    permissions,
  };
  const editingId = document.getElementById('roleModal').dataset.editingId;

  // TODO: replace with await StaffApi.inviteStaff(payload) / StaffApi.updateStaff(editingId, payload)
  if(editingId){
    const idx = staffRoles.findIndex(r=>r.id===editingId);
    if(idx>-1) staffRoles[idx] = {...staffRoles[idx], ...payload};
    logActivity('Updated staff member', name);
  } else {
    staffRoles.push({ id:'STF-'+Date.now(), ...payload });
    logActivity('Added staff member', name);
  }
  closeOverlay('roleModal');
  showToast('Staff member saved','success');
  render();
}

function deleteRole(id){
  const r = staffRoles.find(x=>x.id===id);
  if(!confirm(`Remove ${r?.name||'this staff member'}'s access?`)) return;
  staffRoles = staffRoles.filter(x=>x.id!==id);
  logActivity('Removed staff member', r?.name||id);
  showToast('Staff member removed','info');
  render();
}

// ===== REPORTS =====
function renderReports(c){
  const reportDefs = [
    {id:'roster', icon:'📋', title:'Student Roster', desc:'Full list of students with course, year, GPA and status.'},
    {id:'fees', icon:'💰', title:'Fee Summary', desc:'All recorded fee transactions and outstanding dues.'},
    {id:'attendance', icon:'🗓️', title:'Attendance Summary', desc:'Session-wise attendance percentages by course.'},
    {id:'gpa', icon:'⭐', title:'GPA Report', desc:'GPA breakdown across all currently loaded students.'},
  ];
  c.innerHTML = `
  <div class="students-grid">
    ${reportDefs.map(r=>`<div class="student-card" style="align-items:flex-start;text-align:left">
      <div style="font-size:1.6rem;margin-bottom:8px">${r.icon}</div>
      <div class="student-card-name">${r.title}</div>
      <div style="font-size:0.82rem;color:var(--text2);margin:6px 0 14px">${r.desc}</div>
      <button class="btn btn-primary btn-sm" onclick="generateReport('${r.id}')">⬇️ Generate CSV</button>
    </div>`).join('')}
  </div>
  <p style="color:var(--text3);font-size:0.78rem;margin-top:1rem">
    Reports are generated from data currently loaded in the browser. Fee and attendance reports use the sample data on this page until connected to real endpoints.
  </p>`;
}

async function generateReport(type){
  if(type==='roster' || type==='gpa'){
    await ensureStudentsCache(true);
    const rows = type==='roster'
      ? studentsCache.map(s=>[s.id,s.firstName,s.lastName,s.email,s.course,s.year,s.gpa,s.status])
      : studentsCache.map(s=>[s.id,s.firstName+' '+s.lastName,s.course,s.gpa]);
    const headers = type==='roster'
      ? ['ID','First Name','Last Name','Email','Course','Year','GPA','Status']
      : ['ID','Name','Course','GPA'];
    const csv = [headers, ...rows].map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    downloadTextFile(`${type}_report_${new Date().toISOString().slice(0,10)}.csv`, csv);
  } else if(type==='fees'){
    const headers = ['ID','Student','Type','Amount','Status','Due Date'];
    const rows = feeRecords.map(f=>[f.id,f.studentName,f.feeType,f.amount,f.status,f.dueDate]);
    const csv = [headers, ...rows].map(r=>r.map(v=>`"${String(v??'')}"`).join(',')).join('\n');
    downloadTextFile(`fees_report_${new Date().toISOString().slice(0,10)}.csv`, csv);
  } else if(type==='attendance'){
    const headers = ['Date','Course','Present','Absent','Late','Attendance %'];
    const rows = attendanceRecords.map(r=>[r.date,r.course,r.present,r.absent,r.late,r.presentPct]);
    const csv = [headers, ...rows].map(r=>r.map(v=>`"${String(v??'')}"`).join(',')).join('\n');
    downloadTextFile(`attendance_report_${new Date().toISOString().slice(0,10)}.csv`, csv);
  }
  logActivity('Generated report', type);
  showToast('Report downloaded','success');
}

// ===== ACTIVITY LOG =====
function renderActivity(c){
  const todayCount = activityLogs.filter(a=>new Date(a.timestamp).toDateString()===new Date().toDateString()).length;
  c.innerHTML = `
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-icon blue">📝</div><div><div class="stat-value">${activityLogs.length}</div><div class="stat-label">Total Actions</div></div></div>
    <div class="stat-card"><div class="stat-icon green">📅</div><div><div class="stat-value">${todayCount}</div><div class="stat-label">Actions Today</div></div></div>
  </div>
  <div class="card">
    ${activityLogs.length===0 ? `<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-title">No activity yet</div><p>Actions you take across the portal (sending notifications, recording fees, marking attendance, etc.) will show up here</p></div>` : `
    <div class="table-wrap"><table>
      <thead><tr><th>When</th><th>Staff</th><th>Action</th><th>Details</th></tr></thead>
      <tbody>${activityLogs.map(a=>`<tr>
        <td style="color:var(--text3);font-size:0.8rem">${formatDateTime(a.timestamp)}</td>
        <td>${escapeHtml(a.actor)}</td>
        <td>${escapeHtml(a.action)}</td>
        <td style="color:var(--text2)">${escapeHtml(a.target||'')}</td>
      </tr>`).join('')}</tbody>
    </table></div>`}
  </div>
  <p style="color:var(--text3);font-size:0.78rem;margin-top:1rem">This log is stored locally for this session. Wire it up to a real <code>/activity-log</code> endpoint to persist and share it across staff.</p>`;
}

// ===== CALENDAR / EVENTS =====
function renderCalendar(c){
  const sorted = calendarEvents.slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
  const upcoming = sorted.filter(e=>new Date(e.date) >= new Date(new Date().toDateString())).length;
  c.innerHTML = `
  <div class="toolbar">
    <span style="font-size:0.8rem;color:var(--text3)">${upcoming} upcoming event${upcoming!==1?'s':''} · ${calendarEvents.length} total</span>
    <button class="btn btn-primary" style="margin-left:auto" onclick="openEventModal()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Event
    </button>
  </div>
  <div class="card">
    ${sorted.length===0 ? `<div class="empty-state"><div class="empty-icon">🗓️</div><div class="empty-title">No events scheduled</div><p>Add exam dates, holidays, or deadlines for staff and students to track</p></div>` :
    sorted.map(e=>{
      const d = new Date(e.date);
      return `<div class="event-card">
        <div class="event-date-box"><div class="event-date-day">${d.getDate()}</div><div class="event-date-mon">${d.toLocaleString('en-IN',{month:'short'})}</div></div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <div style="font-weight:600;font-size:0.9rem">${escapeHtml(e.title)}</div>
            <span class="event-cat cat-${e.category.toLowerCase()}">${e.category}</span>
          </div>
          <div style="font-size:0.82rem;color:var(--text2);margin-top:4px">${escapeHtml(e.description||'')}</div>
        </div>
        <button class="btn-icon" title="Delete" style="border-color:#fecaca" onclick="deleteEvent('${e.id}')">🗑️</button>
      </div>`;
    }).join('')}
  </div>`;
}

function openEventModal(){
  ['evTitle','evDesc'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('evDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('evCategory').value = 'Event';
  showModal('eventModal');
}

function submitEvent(){
  const title = document.getElementById('evTitle').value.trim();
  const date = document.getElementById('evDate').value;
  if(!title || !date){ showToast('Please fill in the title and date','error'); return; }
  // TODO: replace with await CalendarApi.createEvent(payload)
  calendarEvents.push({
    id: 'EV-'+Date.now(), title, date,
    category: document.getElementById('evCategory').value,
    description: document.getElementById('evDesc').value.trim(),
  });
  logActivity('Added calendar event', title);
  closeOverlay('eventModal');
  showToast('Event added','success');
  render();
}

function deleteEvent(id){
  if(!confirm('Delete this event?')) return;
  calendarEvents = calendarEvents.filter(e=>e.id!==id);
  logActivity('Deleted calendar event', id);
  showToast('Event deleted','info');
  render();
}

// ===== MESSAGES =====
async function renderMessages(c){
  await ensureStudentsCache();
  c.innerHTML = `
  <div class="toolbar">
    <span style="font-size:0.8rem;color:var(--text3)">${messageThreads.length} conversation${messageThreads.length!==1?'s':''}</span>
    <button class="btn btn-primary" style="margin-left:auto" onclick="openMessageModal()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      New Message
    </button>
  </div>
  <div class="card" style="display:grid;grid-template-columns:280px 1fr;min-height:420px;overflow:hidden">
    <div style="border-right:1px solid var(--border);overflow-y:auto">
      ${messageThreads.length===0 ? `<div class="notif-empty">No conversations yet</div>` :
      messageThreads.map(t=>`<div class="msg-thread ${t.studentId===activeThreadStudentId?'active':''}" style="${t.studentId===activeThreadStudentId?'background:var(--surface2)':''}" onclick="activeThreadStudentId='${t.studentId}';render()">
        <div class="avatar" style="background:var(--accent2);width:32px;height:32px;font-size:0.7rem">${initialsFromName(t.studentName)}</div>
        <div style="min-width:0">
          <div style="font-weight:600;font-size:0.85rem">${escapeHtml(t.studentName)}</div>
          <div style="font-size:0.76rem;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml((t.messages[t.messages.length-1]?.text)||'')}</div>
        </div>
      </div>`).join('')}
    </div>
    <div style="display:flex;flex-direction:column">
      ${renderActiveThread()}
    </div>
  </div>`;
}

function renderActiveThread(){
  const thread = messageThreads.find(t=>t.studentId===activeThreadStudentId);
  if(!thread){
    return `<div class="empty-state" style="margin:auto"><div class="empty-icon">💬</div><div class="empty-title">Select a conversation</div><p>Or start a new one with "New Message"</p></div>`;
  }
  return `
  <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border);font-weight:600;font-size:0.9rem">${escapeHtml(thread.studentName)}</div>
  <div style="flex:1;padding:1.25rem;display:flex;flex-direction:column;gap:10px;overflow-y:auto">
    ${thread.messages.map(m=>`<div class="msg-bubble ${m.from==='staff'?'out':'in'}">${escapeHtml(m.text)}</div>`).join('')}
  </div>
  <div style="padding:1rem;border-top:1px solid var(--border);display:flex;gap:8px">
    <input type="text" id="threadReplyInput" placeholder="Type a reply…" onkeydown="if(event.key==='Enter')sendThreadReply()">
    <button class="btn btn-primary btn-sm" onclick="sendThreadReply()">Send</button>
  </div>`;
}

function sendThreadReply(){
  const input = document.getElementById('threadReplyInput');
  const text = input.value.trim();
  if(!text) return;
  const thread = messageThreads.find(t=>t.studentId===activeThreadStudentId);
  if(!thread) return;
  // TODO: replace with await MessagesApi.sendMessage(thread.studentId, text)
  thread.messages.push({from:'staff', text, time: new Date().toISOString()});
  logActivity('Sent message', thread.studentName);
  render();
}

function openMessageModal(){
  document.getElementById('msgStudent').innerHTML = studentSelectOptions(studentsCache);
  document.getElementById('msgBody').value = '';
  showModal('messageModal');
}

function submitMessage(){
  const sel = document.getElementById('msgStudent');
  const studentId = sel.value;
  const studentName = sel.selectedOptions[0]?.textContent || '';
  const text = document.getElementById('msgBody').value.trim();
  if(!studentId || !text){ showToast('Please choose a student and write a message','error'); return; }

  let thread = messageThreads.find(t=>t.studentId===studentId);
  if(!thread){
    thread = { studentId, studentName, messages: [] };
    messageThreads.unshift(thread);
  }
  // TODO: replace with await MessagesApi.sendMessage(studentId, text)
  thread.messages.push({from:'staff', text, time: new Date().toISOString()});
  activeThreadStudentId = studentId;
  logActivity('Started conversation', studentName);
  closeOverlay('messageModal');
  showToast('Message sent','success');
  render();
}

// ===== SETTINGS =====
let appSettings = {
  emailNotifs: true, smsAlerts: false, autoVerifyDocs: false, weeklyDigest: true,
  instituteName: 'EduReg University', supportEmail: 'support@eduregportal.edu',
};
function renderSettings(c){
  c.innerHTML = `
  <div class="card" style="margin-bottom:1.5rem">
    <div class="settings-section">
      <div class="form-section-title">Institute Details</div>
      <div class="form-grid">
        <div class="form-group"><label>Institute Name</label><input type="text" id="setInstituteName" value="${escapeHtml(appSettings.instituteName)}"></div>
        <div class="form-group"><label>Support Email</label><input type="email" id="setSupportEmail" value="${escapeHtml(appSettings.supportEmail)}"></div>
      </div>
    </div>
    <div class="settings-section">
      <div class="form-section-title">Notification Preferences</div>
      <div class="settings-row"><span>Email notifications for staff</span><div class="toggle-switch ${appSettings.emailNotifs?'on':''}" onclick="toggleSetting('emailNotifs',this)"></div></div>
      <div class="settings-row"><span>SMS alerts for urgent notices</span><div class="toggle-switch ${appSettings.smsAlerts?'on':''}" onclick="toggleSetting('smsAlerts',this)"></div></div>
      <div class="settings-row"><span>Weekly summary digest</span><div class="toggle-switch ${appSettings.weeklyDigest?'on':''}" onclick="toggleSetting('weeklyDigest',this)"></div></div>
    </div>
    <div class="settings-section">
      <div class="form-section-title">Document Handling</div>
      <div class="settings-row"><span>Auto-verify documents on upload</span><div class="toggle-switch ${appSettings.autoVerifyDocs?'on':''}" onclick="toggleSetting('autoVerifyDocs',this)"></div></div>
    </div>
    <div class="settings-section">
      <button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>
    </div>
  </div>
  <p style="color:var(--text3);font-size:0.78rem">Settings are stored locally for this session. Wire this up to a <code>/settings</code> endpoint to persist across staff and devices.</p>`;
}

function toggleSetting(key, el){
  appSettings[key] = !appSettings[key];
  el.classList.toggle('on', appSettings[key]);
}

function saveSettings(){
  appSettings.instituteName = document.getElementById('setInstituteName').value.trim();
  appSettings.supportEmail = document.getElementById('setSupportEmail').value.trim();
  // TODO: replace with await SettingsApi.updateSettings(appSettings)
  logActivity('Updated settings', 'Institute preferences');
  showToast('Settings saved','success');
}

// ===== HELP & SUPPORT =====
function renderHelp(c){
  const faqs = [
    ['How do I register a new student?', 'Go to Students, click "Add Student", fill in the personal and academic information, then save.'],
    ['How do I send a notification to students?', 'Go to Notifications, click "Send Notification", choose your audience (all, a course, a status, or one student), then write your message.'],
    ['How do I mark attendance?', 'Go to Attendance, click "Mark Attendance", pick a course and date, then mark each student present, late, or absent.'],
    ['How do I record a fee payment?', 'Go to Fees & Payments, click "Record Payment", select the student, and fill in the amount and status.'],
    ['Who can I contact for technical issues?', `Reach out to ${appSettings.supportEmail} and our team will get back to you.`],
  ];
  c.innerHTML = `
  <div class="card" style="margin-bottom:1.5rem">
    <div class="card-header"><div class="card-title">Frequently Asked Questions</div></div>
    ${faqs.map(([q,a])=>`<details class="help-faq"><summary>${q} <span>›</span></summary><p>${a}</p></details>`).join('')}
  </div>
  <div class="card" style="padding:1.5rem">
    <div class="card-title" style="margin-bottom:8px">Still need help?</div>
    <p style="color:var(--text2);font-size:0.88rem;margin-bottom:1rem">Send our support team a message and we'll follow up over email.</p>
    <a class="btn btn-primary" href="mailto:${escapeHtml(appSettings.supportEmail)}?subject=EduReg%20Support%20Request">✉️ Contact Support</a>
  </div>`;
}

// ===== ACCOUNT / SIDEBAR =====
function initSidebarUser(){
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (!user) {
    window.location.href = 'login_signup.html';
    return false;
  }
  const nameEl = document.getElementById('sidebarUserName');
  const roleEl = document.getElementById('sidebarUserRole');
  const avatarEl = document.getElementById('sidebarAvatar');
  if (nameEl) nameEl.textContent = user.name || 'User';
  if (roleEl) roleEl.textContent = user.role || 'Registrar';
  if (avatarEl) avatarEl.textContent = initialsFromName(user.name);
  return true;
}

function initialsFromName(name){
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U';
}

async function handleLogout(){
  try { await AuthApi.logout(); } catch (e) { /* clear locally even if the request fails */ }
  clearCurrentUser();
  window.location.href = 'login_signup.html';
}

// ===== HELPERS =====
function initials(s){return (s.firstName[0]+(s.lastName[0]||'')).toUpperCase()}
function courseColor(c){return COURSES_COLORS[c]||['#f1f5f9','#475569']}
function gpaColor(g){if(!g)return 'var(--text3)';if(g>=8.5)return '#16a34a';if(g>=7)return '#2563eb';if(g>=5)return '#d97706';return '#dc2626'}
function formatDate(d){if(!d)return '—';try{return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}catch{return d}}
function statusBadge(s){const m={Active:'status-active',Inactive:'status-inactive',Pending:'status-pending',Graduated:'status-graduated'};return `<span class="status ${m[s]||''}"><span class="status-dot"></span>${s}</span>`}
function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

function showToast(msg, type='info'){
  const cont = document.getElementById('toastContainer');
  const t = document.createElement('div');
  const icons = {success:'✅',error:'❌',info:'ℹ️'};
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  cont.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),400)},3000);
}

// ===== INIT =====
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    ['studentModal', 'confirmModal', 'viewModal', 'notifyModal', 'attendanceModal', 'feeModal', 'documentModal', 'timetableModal', 'importModal', 'roleModal', 'eventModal', 'messageModal'].forEach(closeOverlay);
    deleteId = null;
    closeNotifDropdown();
  }
});
if (initSidebarUser()) {
  loadCourses().finally(render);
  refreshNotifBell();
  setInterval(refreshNotifBell, 60000);
}




