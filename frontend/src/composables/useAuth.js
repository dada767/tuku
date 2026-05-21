import { ref, computed } from 'vue'
import { apiGet, apiPost } from '../api/client.js'

function loadUserFromStorage() {
  try {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

const user = ref(loadUserFromStorage())
const token = ref(localStorage.getItem('access_token'))
const isAuthenticated = computed(() => !!token.value)
const isAdmin = computed(() => user.value?.is_admin ?? false)

export function useAuth() {
  async function login(username, password) {
    const data = await apiPost('/auth/login', { username, password })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('user', JSON.stringify(data.user))
    token.value = data.access_token
    user.value = data.user
    return data
  }

  async function register(username, password) {
    const data = await apiPost('/auth/register', { username, password })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('user', JSON.stringify(data.user))
    token.value = data.access_token
    user.value = data.user
    return data
  }

  async function fetchMe() {
    if (!token.value) return
    try {
      user.value = await apiGet('/auth/me')
      if (user.value) {
        localStorage.setItem('user', JSON.stringify(user.value))
      }
    } catch {
      logout()
    }
  }

  function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    token.value = null
    user.value = null
  }

  if (token.value && !user.value) {
    fetchMe()
  }

  return { user, token, isAuthenticated, isAdmin, login, register, fetchMe, logout }
}
