<template>
  <div class="admin-page">
    <h3 class="page-title">仪表盘</h3>

    <!-- Loading -->
    <div v-if="loading" class="admin-loading">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="admin-error">
      <p>{{ error }}</p>
      <button class="btn btn-primary" @click="loadStats">重试</button>
    </div>

    <!-- Stats -->
    <template v-else-if="stats">
      <!-- Stat cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon stat-icon--images">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.total_images ?? 0 }}</span>
            <span class="stat-label">图片总数</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon stat-icon--users">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.total_users ?? 0 }}</span>
            <span class="stat-label">用户总数</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon stat-icon--storage">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ formatBytes(stats.total_storage_bytes ?? 0) }}</span>
            <span class="stat-label">存储用量</span>
          </div>
        </div>

        <div v-if="stats.recent_uploads?.length" class="stat-card">
          <div class="stat-icon stat-icon--recent">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.recent_uploads.length }}</span>
            <span class="stat-label">最近上传</span>
          </div>
        </div>
      </div>

      <!-- Format breakdown -->
      <div v-if="stats.format_breakdown" class="admin-section">
        <h4 class="section-title">格式分布</h4>
        <div class="format-grid">
          <div v-for="(count, fmt) in stats.format_breakdown" :key="fmt" class="format-item">
            <span class="format-name">{{ fmt.toUpperCase() }}</span>
            <div class="format-bar-wrap">
              <div
                class="format-bar"
                :style="{ width: formatPercent(count) + '%' }"
              ></div>
            </div>
            <span class="format-count">{{ count }}</span>
          </div>
        </div>
        <div v-if="!hasFormats" class="empty-text">暂无格式数据</div>
      </div>

      <!-- Recent uploads -->
      <div v-if="stats.recent_uploads?.length" class="admin-section">
        <h4 class="section-title">最近上传</h4>
        <div class="data-table">
          <div class="table-header">
            <span>文件名</span>
            <span>格式</span>
            <span>大小</span>
            <span>上传时间</span>
          </div>
          <div v-for="img in stats.recent_uploads" :key="img.filename" class="table-row">
            <span class="table-cell-filename">{{ img.filename }}</span>
            <span>{{ getFormat(img.filename).toUpperCase() }}</span>
            <span>{{ formatBytes(img.size) }}</span>
            <span class="table-cell-date">{{ formatDate(img.uploaded_at) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchStats } from '../../api/admin.js'

const stats = ref(null)
const loading = ref(false)
const error = ref('')

const totalFormatCount = computed(() => {
  if (!stats.value?.format_breakdown) return 0
  return Object.values(stats.value.format_breakdown).reduce((a, b) => a + b, 0)
})

const hasFormats = computed(() => totalFormatCount.value > 0)

function formatPercent(count) {
  if (!totalFormatCount.value) return 0
  return Math.round((count / totalFormatCount.value) * 100)
}

function getFormat(filename) {
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function loadStats() {
  loading.value = true
  error.value = ''
  try {
    stats.value = await fetchStats()
  } catch (err) {
    error.value = err.message || '加载统计数据失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadStats()
})
</script>
