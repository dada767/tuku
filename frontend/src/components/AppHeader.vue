<template>
  <header class="header">
    <div class="header-left">
      <h1 class="header-title">我的图库</h1>
      <nav class="header-nav">
        <router-link to="/" class="nav-link" :class="{ 'nav-link--active': isGalleryActive }">画廊</router-link>
        <router-link v-if="auth.isAdmin.value" to="/admin" class="nav-link" active-class="nav-link--active">管理</router-link>
      </nav>
    </div>
    <div class="header-actions">
      <span class="image-count">{{ countText }}</span>
      <button class="btn btn-primary" @click="$emit('upload-click')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        上传图片
      </button>
      <template v-if="auth.isAuthenticated.value">
        <span class="header-user">{{ auth.user.value?.username }}</span>
        <button class="btn btn-ghost" @click="handleLogout">登出</button>
      </template>
      <template v-else>
        <router-link to="/register" class="btn btn-ghost">注册</router-link>
        <router-link to="/login" class="btn btn-ghost">登录</router-link>
      </template>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'

const auth = useAuth()
const router = useRouter()
const route = useRoute()

const props = defineProps({
  imageCount: { type: Number, default: 0 }
})

defineEmits(['upload-click'])

const countText = computed(() => {
  const n = props.imageCount
  return n === 0 ? '暂无图片' : `共 ${n} 张图片`
})

const isGalleryActive = computed(() => route.path === '/')

function handleLogout() {
  auth.logout()
  router.push('/')
}
</script>
