import { apiGet, apiPost, apiPut, apiDelete } from './client.js'

export function fetchStats() {
  return apiGet('/admin/stats')
}

export function fetchUsers() {
  return apiGet('/admin/users')
}

export function createUser(username, password, isAdmin) {
  return apiPost('/admin/users', { username, password, is_admin: isAdmin })
}

export function updateUser(id, data) {
  return apiPut(`/admin/users/${id}`, data)
}

export function deleteUser(id) {
  return apiDelete(`/admin/users/${id}`)
}

export function fetchAdminImages(page = 1, perPage = 20, format = '') {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('per_page', String(perPage))
  if (format) {
    params.set('format', format)
  }
  return apiGet(`/admin/images?${params.toString()}`)
}

export function batchDeleteImages(filenames) {
  return apiPost('/admin/images/batch-delete', { filenames })
}

export function fetchSettings() {
  return apiGet('/admin/settings')
}

export function updateSettings(settings) {
  return apiPut('/admin/settings', settings)
}

export function convertImage(filename, targetFormat, quality = 85) {
  return apiPost(`/convert/${encodeURIComponent(filename)}`, {
    target_format: targetFormat,
    quality,
  })
}
