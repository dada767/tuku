const BASE = '/api'

function authHeaders() {
  const token = localStorage.getItem('access_token')
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

export async function fetchImages() {
  const res = await fetch(`${BASE}/images`, {
    headers: { ...authHeaders() },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function uploadImages(files) {
  const formData = new FormData()
  for (const file of files) {
    formData.append('images', file)
  }
  const res = await fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: formData
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function deleteImage(filename) {
  const res = await fetch(`${BASE}/images/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function inpaintImage(filename, maskBlob, radius) {
  const formData = new FormData()
  formData.append('mask', maskBlob, 'mask.png')
  formData.append('radius', String(radius))
  const res = await fetch(`${BASE}/inpaint/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: formData
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function saveEdited(filename, imageBlob, action) {
  const formData = new FormData()
  formData.append('image', imageBlob, 'edited.png')
  formData.append('action', action)
  const res = await fetch(`${BASE}/save-edited/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: formData
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
