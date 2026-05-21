<template>
  <div class="admin-page">
    <h3 class="page-title">系统设置</h3>

    <!-- Loading -->
    <div v-if="loading" class="admin-loading">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="admin-error">
      <p>{{ error }}</p>
      <button class="btn btn-primary" @click="loadSettings">重试</button>
    </div>

    <!-- Settings form -->
    <template v-else>
      <div v-if="saveSuccess" class="toast-success-fixed">保存成功</div>

      <form class="settings-form" @submit.prevent="handleSave">
        <div class="form-group">
          <label for="max-upload-size">最大上传大小 (MB)</label>
          <input
            id="max-upload-size"
            v-model.number="form.max_upload_size_mb"
            type="number"
            class="form-input"
            min="1"
            step="1"
          />
        </div>

        <div class="form-group">
          <label>允许的图片格式</label>
          <div class="checkbox-group">
            <label v-for="fmt in formats" :key="fmt.value" class="form-checkbox">
              <input
                :value="fmt.value"
                v-model="form.allowed_formats"
                type="checkbox"
                :disabled="form.allowed_formats.length <= 1 && form.allowed_formats.includes(fmt.value)"
              />
              {{ fmt.label }}
            </label>
          </div>
        </div>

        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? '保存中...' : '保存设置' }}
        </button>
      </form>

      <!-- Storage info -->
      <div v-if="stats" class="admin-section">
        <h4 class="section-title">存储信息</h4>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-info">
              <span class="stat-value">{{ stats.total_images ?? 0 }}</span>
              <span class="stat-label">图片总数</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-info">
              <span class="stat-value">{{ formatBytes(stats.total_storage_bytes ?? 0) }}</span>
              <span class="stat-label">总存储用量</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { fetchSettings, updateSettings, fetchStats } from '../../api/admin.js'

const loading = ref(false)
const error = ref('')
const saving = ref(false)
const saveSuccess = ref(false)
const stats = ref(null)

const formats = [
  { value: 'jpg', label: 'JPG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'gif', label: 'GIF' },
  { value: 'webp', label: 'WebP' },
  { value: 'bmp', label: 'BMP' },
]

const form = ref({
  max_upload_size_mb: 10,
  allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'],
})

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

async function loadSettings() {
  loading.value = true
  error.value = ''
  try {
    const [settingsData, statsData] = await Promise.all([
      fetchSettings(),
      fetchStats(),
    ])
    if (settingsData) {
      form.value.max_upload_size_mb = settingsData.max_upload_size_mb ?? form.value.max_upload_size_mb
      const raw = settingsData.allowed_formats
      form.value.allowed_formats = typeof raw === 'string' ? raw.split(',').map(s => s.trim()).filter(Boolean) : (raw ?? form.value.allowed_formats)
    }
    stats.value = statsData
  } catch (err) {
    error.value = err.message || '加载设置失败'
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  saveSuccess.value = false
  error.value = ''
  try {
    const allowed = Array.isArray(form.value.allowed_formats)
      ? form.value.allowed_formats.join(',')
      : form.value.allowed_formats
    await updateSettings({
      max_upload_size_mb: String(form.value.max_upload_size_mb),
      allowed_formats: allowed,
      storage_path: 'uploads',
    })
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (err) {
    error.value = err.message || '保存设置失败'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadSettings()
})
</script>
