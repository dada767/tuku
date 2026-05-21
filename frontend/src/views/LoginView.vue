<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="handleLogin">
      <h2 class="login-title">登录管理后台</h2>

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
          placeholder="请输入密码"
          required
          autocomplete="current-password"
        />
      </div>

      <button type="submit" class="btn btn-primary login-btn" :disabled="loading">
        {{ loading ? '登录中...' : '登录' }}
      </button>

      <router-link to="/register" class="login-back">还没有账号？去注册</router-link>
      <router-link to="/" class="login-back">返回画廊</router-link>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'

const auth = useAuth()
const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    const data = await auth.login(username.value, password.value)
    const redirect = route.query.redirect || (data.user?.is_admin ? '/admin/dashboard' : '/')
    router.push(redirect)
  } catch (err) {
    error.value = err.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>
