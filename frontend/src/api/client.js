const BASE = '/api'

function getToken() {
  return localStorage.getItem('access_token')
}

function authHeaders() {
  const token = getToken()
  const headers = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function handleResponse(res) {
  if (res.status === 401) {
    localStorage.removeItem('access_token')
    window.location.href = '/login'
    throw new Error('未授权，请重新登录')
  }
  if (!res.ok) {
    let message
    try {
      const json = await res.json()
      message = json.message || json.error || `HTTP ${res.status}`
    } catch {
      message = `HTTP ${res.status}`
    }
    throw new Error(message)
  }
  return res.json()
}

export async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      ...authHeaders(),
    },
  })
  return handleResponse(res)
}

export async function apiPost(path, body) {
  const headers = { ...authHeaders() }
  let bodyToSend = body

  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
    bodyToSend = JSON.stringify(body)
  }

  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: bodyToSend,
  })
  return handleResponse(res)
}

export async function apiPut(path, body) {
  const headers = { ...authHeaders() }
  let bodyToSend = body

  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
    bodyToSend = JSON.stringify(body)
  }

  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers,
    body: bodyToSend,
  })
  return handleResponse(res)
}

export async function apiDelete(path) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: {
      ...authHeaders(),
    },
  })
  return handleResponse(res)
}
