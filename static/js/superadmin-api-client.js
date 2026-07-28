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
};
