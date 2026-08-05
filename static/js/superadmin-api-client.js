// ===== SUPER ADMIN API CLIENT =====
// Mirrors the pattern in api-client.js / StudentApi.
// This file only defines the calls the UI makes — the actual Flask routes
// and DB logic in controller.py / model.py are written separately.
//
// Expected backend routes (all should require role=super_admin via require_role):
//   GET    /superadmin/stats
//   GET    /superadmin/schools?search=&status=&plan=
//   GET    /superadmin/schools/<id>
//   POST   /superadmin/schools
//   PUT    /superadmin/schools/<id>
//   POST   /superadmin/schools/<id>/suspend
//   POST   /superadmin/schools/<id>/activate
//   DELETE /superadmin/schools/<id>
//   GET    /superadmin/schools/<id>/admins
//   POST   /superadmin/schools/<id>/resend-invite
//   GET    /superadmin/activity-log?limit=

const SuperAdminApi = {
  getStats() {
    return requestApi('/superadmin/stats');
  },

  getSchools(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.plan) params.set('plan', filters.plan);
    const query = params.toString();
    return requestApi(`/superadmin/schools${query ? `?${query}` : ''}`);
  },

  getSchool(schoolId) {
    return requestApi(`/superadmin/schools/${schoolId}`);
  },

  createSchool(schoolData) {
    return requestApi('/superadmin/schools', {
      method: 'POST',
      body: JSON.stringify(schoolData),
    });
  },

  updateSchool(schoolId, schoolData) {
    return requestApi(`/superadmin/schools/${schoolId}`, {
      method: 'PUT',
      body: JSON.stringify(schoolData),
    });
  },

  suspendSchool(schoolId) {
    return requestApi(`/superadmin/schools/${schoolId}/suspend`, { method: 'POST' });
  },

  activateSchool(schoolId) {
    return requestApi(`/superadmin/schools/${schoolId}/activate`, { method: 'POST' });
  },

  deleteSchool(schoolId) {
    return requestApi(`/superadmin/schools/${schoolId}`, { method: 'DELETE' });
  },

  getSchoolAdmins(schoolId) {
    return requestApi(`/superadmin/schools/${schoolId}/admins`);
  },

  resendInvite(schoolId) {
    return requestApi(`/superadmin/schools/${schoolId}/resend-invite`, { method: 'POST' });
  },

  getActivityLog(limit = 20) {
    return requestApi(`/superadmin/activity-log?limit=${limit}`);
  },

  // ---- Students (cross-tenant, read-only) ----
  // GET /superadmin/students?search=&school_id=&status=&plan=&page=&per_page=
  getStudents(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.schoolId) params.set('school_id', filters.schoolId);
    if (filters.status) params.set('status', filters.status);
    if (filters.plan) params.set('plan', filters.plan);
    if (filters.page) params.set('page', filters.page);
    if (filters.perPage) params.set('per_page', filters.perPage);
    const query = params.toString();
    return requestApi(`/superadmin/students${query ? `?${query}` : ''}`);
  },
  getStudent(studentId) {
    return requestApi(`/superadmin/students/${studentId}`);
  },
  impersonateSchoolAdmin(schoolId) {
    // POST /superadmin/schools/<id>/impersonate — issues a scoped, audit-logged session token
    return requestApi(`/superadmin/schools/${schoolId}/impersonate`, { method: 'POST' });
  },

  // ---- Employees (internal company/platform team — invite-only) ----
  // GET    /superadmin/employees?search=&department=&role=&status=
  // GET    /superadmin/employees/<id>
  // POST   /superadmin/employees                 { name, email, ... }  -> sends invite link (?token=&role=)
  // PUT    /superadmin/employees/<id>
  // POST   /superadmin/employees/<id>/suspend
  // POST   /superadmin/employees/<id>/activate
  // DELETE /superadmin/employees/<id>
  // POST   /superadmin/employees/<id>/resend-invite
  getEmployees(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.department) params.set('department', filters.department);
    if (filters.role) params.set('role', filters.role);
    if (filters.status) params.set('status', filters.status);
    const query = params.toString();
    return requestApi(`/superadmin/employees${query ? `?${query}` : ''}`);
  },

  getEmployee(employeeId) {
    return requestApi(`/superadmin/employees/${employeeId}`);
  },

  inviteEmployee(employeeData) {
    // Backend creates a pending employee record + invite token, then emails
    // set-password.html?token=<token>&role=<role> to employeeData.email.
    return requestApi('/superadmin/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData),
    });
  },

  updateEmployee(employeeId, employeeData) {
    return requestApi(`/superadmin/employees/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify(employeeData),
    });
  },

  suspendEmployee(employeeId) {
    return requestApi(`/superadmin/employees/${employeeId}/suspend`, { method: 'POST' });
  },

  activateEmployee(employeeId) {
    return requestApi(`/superadmin/employees/${employeeId}/activate`, { method: 'POST' });
  },

  deleteEmployee(employeeId) {
    return requestApi(`/superadmin/employees/${employeeId}`, { method: 'DELETE' });
  },

  resendEmployeeInvite(employeeId) {
    return requestApi(`/superadmin/employees/${employeeId}/resend-invite`, { method: 'POST' });
  },

  // ---- Onboarding pipeline ----
  // GET /superadmin/onboarding — schools grouped by pipeline stage
  getOnboardingPipeline() {
    return requestApi('/superadmin/onboarding');
  },
  moveOnboardingStage(schoolId, stage) {
    return requestApi(`/superadmin/onboarding/${schoolId}`, {
      method: 'PUT',
      body: JSON.stringify({ stage }),
    });
  },

  // ---- Revenue ----
  // GET /superadmin/revenue — MRR, plan mix, renewals due, churn
  getRevenue() {
    return requestApi('/superadmin/revenue');
  },

  // ---- Support tickets ----
  // GET /superadmin/tickets?status=&priority=&school_id=
  getTickets(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.schoolId) params.set('school_id', filters.schoolId);
    const query = params.toString();
    return requestApi(`/superadmin/tickets${query ? `?${query}` : ''}`);
  },
  updateTicketStatus(ticketId, status) {
    return requestApi(`/superadmin/tickets/${ticketId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  // ---- Impersonation audit log ----
  // GET /superadmin/impersonation-log?limit=
  getImpersonationLog(limit = 50) {
    return requestApi(`/superadmin/impersonation-log?limit=${limit}`);
  },

  // ---- Notifications / broadcasts ----
  // GET  /superadmin/notifications
  // POST /superadmin/notifications  { title, body, audience }
  getNotifications() {
    return requestApi('/superadmin/notifications');
  },
  sendNotification(payload) {
    return requestApi('/superadmin/notifications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // ---- Feature flags ----
  // GET /superadmin/feature-flags
  // PUT /superadmin/feature-flags/<key>  { enabled, scope, planOrSchoolId }
  getFeatureFlags() {
    return requestApi('/superadmin/feature-flags');
  },
  updateFeatureFlag(key, payload) {
    return requestApi(`/superadmin/feature-flags/${key}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // ---- API & usage monitor ----
  // GET /superadmin/api-usage — per-school API call volume, storage %, rate-limit hits
  getApiUsage() {
    return requestApi('/superadmin/api-usage');
  },
};
