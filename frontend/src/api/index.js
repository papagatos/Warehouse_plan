import api from './client.js'

// ── Auth ────────────────────────────────────────────────────
export const authApi = {
  login: (email, password) =>
    api.post('/auth/login', { email, password }).then(r => r.data),

  me: () =>
    api.get('/auth/me').then(r => r.data),

  register: (token, data) =>
    api.post('/auth/register', { token, ...data }).then(r => r.data),

  checkInvite: (token) =>
    api.get(`/auth/invite/${token}`).then(r => r.data),

  createInvite: (role, expiresInDays = 7) =>
    api.post('/auth/invites', { role, expiresInDays }).then(r => r.data),

  getInvites: () =>
    api.get('/auth/invites').then(r => r.data),
}

// ── Plans ───────────────────────────────────────────────────
export const plansApi = {
  list: () =>
    api.get('/plans').then(r => r.data),

  getByDate: (date) =>
    api.get(`/plans/${date}`).then(r => r.data),

  upload: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/plans/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data)
  },

  updateStatus: (rowId, status, comment = '', pallets = undefined, postponedDate = undefined) =>
    api.patch(`/plans/rows/${rowId}/status`, { status, comment, ...(pallets !== undefined && { pallets }), ...(postponedDate !== undefined && { postponedDate }) }).then(r => r.data),

  getHistory: (rowId) =>
    api.get(`/plans/rows/${rowId}/history`).then(r => r.data),
}

// ── Photos ──────────────────────────────────────────────────
export const photosApi = {
  upload: (rowId, files, photoType) => {
    const form = new FormData()
    files.forEach(f => form.append('photos', f))
    form.append('photoType', photoType)
    return api.post(`/photos/${rowId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data)
  },

  getForRow: (rowId) =>
    api.get(`/photos/${rowId}`).then(r => r.data),

  delete: (photoId) =>
    api.delete(`/photos/${photoId}`).then(r => r.data),
}

// ── Admin ───────────────────────────────────────────────────
export const adminApi = {
  getUsers: () =>
    api.get('/admin/users').then(r => r.data),

  updateRole: (userId, role) =>
    api.patch(`/admin/users/${userId}/role`, { role }).then(r => r.data),

  deactivate: (userId) =>
    api.patch(`/admin/users/${userId}/deactivate`).then(r => r.data),

  resetPassword: (userId, password) =>
    api.post(`/admin/users/${userId}/reset-password`, { password }).then(r => r.data),
}
