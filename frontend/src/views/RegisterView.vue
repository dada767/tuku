<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="handleRegister">
      <h2 class="login-title">注册账号</h2>

      <div v-if="error" class="login-error">{{ error }}</div>

      <div class="form-group">
        <label for="username">用户名</label>
        <input
          id="username"
          v-model="username"
          type="text"
          class="form-input"
          placeholder="请输入用户名"
          required
          autocomplete="username"
        />
      </div>

      <div class="form-group">
        <label for="password">密码</label>
        <input
          id="password"
          v-model="password"
          type="password"
          class="form-input"
          placeholder="请输入密码（至少6位）"
          required
          autocomplete="new-password"
        />
      </div>

      <div class="form-group">
        <label for="confirmPassword">确认密码</label>
        <input
          id="confirmPassword"
          v-model="confirmPassword"
          type="password"
          class="form-input"
          placeholder="请再次输入密码"
          required
          autocomplete="new-password"
        />
      </div>

      <button type="submit" class="btn btn-primary login-btn" :disabled="loading">
        {{ loading ? '注册中...' : '注册' }}
      </button>

      <router-link to="/login" class="login-back">已有账号？去登录</router-link>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'

const auth = useAuth()
const router = useRouter()

const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

async function handleRegister() {
  error.value = ''

  if (password.value.length < 6) {
    error.value = '密码长度不能少于6位'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致'
    return
  }

  loading.value = true
  try {
    await auth.register(username.value, password.value)
    router.push('/')
  } catch (err) {
    error.value = err.message || '注册失败'
  } finally {
    loading.value = false
  }
}
</script>
