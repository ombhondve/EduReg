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
  const titles = {dashboard:['Dashboard','Overview of registrations'],students:['Students','Manage all student records'],courses:['Courses','Available programs'],analytics:['Analytics','Detailed statistics']};
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
    <div style="display:flex;gap:10px;margin-top:1.5rem">
      <button class="btn btn-primary" onclick="closeOverlay('viewModal');openEditModal('${s.id}')">✏️ Edit Student</button>
      <button class="btn btn-danger" onclick="closeOverlay('viewModal');openDelete('${s.id}')">🗑️ Delete</button>
    </div>`;
    showModal('viewModal');
  } catch (err) {
    showToast('Failed to load student profile', 'error');
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
    ['studentModal', 'confirmModal', 'viewModal'].forEach(closeOverlay);
    deleteId = null;
  }
});
if (initSidebarUser()) {
  loadCourses().finally(render);
}




