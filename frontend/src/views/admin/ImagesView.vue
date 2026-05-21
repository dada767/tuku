<template>
  <div class="admin-page">
    <div class="page-header">
      <h3 class="page-title">图片管理</h3>
      <div class="page-header-actions">
        <select v-model="formatFilter" class="form-select" @change="onFilterChange">
          <option value="">全部格式</option>
          <option value="jpg">JPG</option>
          <option value="jpeg">JPEG</option>
          <option value="png">PNG</option>
          <option value="gif">GIF</option>
          <option value="webp">WebP</option>
          <option value="bmp">BMP</option>
        </select>
        <button
          class="btn btn-danger"
          :disabled="selectedFilenames.length === 0"
          @click="handleBatchDelete"
        >
          批量删除 ({{ selectedFilenames.length }})
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="admin-loading">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="admin-error">
      <p>{{ error }}</p>
      <button class="btn btn-primary" @click="loadImages">重试</button>
    </div>

    <!-- Empty -->
    <div v-else-if="images.length === 0" class="empty-text">暂无图片</div>

    <!-- Images table -->
    <template v-else>
      <div class="data-table">
        <div class="table-header">
          <span>
            <input
              type="checkbox"
              :checked="allSelected"
              :indeterminate="someSelected && !allSelected"
              @change="toggleAll"
            />
          </span>
          <span>文件名</span>
          <span>格式</span>
          <span>大小</span>
          <span>上传时间</span>
          <span>操作</span>
        </div>
        <div v-for="img in images" :key="img.filename" class="table-row">
          <span>
            <input
              type="checkbox"
              :value="img.filename"
              v-model="selectedFilenames"
            />
          </span>
          <span class="table-cell-filename">{{ img.filename }}</span>
          <span>{{ getFormat(img.filename).toUpperCase() }}</span>
          <span>{{ img.size_formatted || formatBytes(img.size) }}</span>
          <span class="table-cell-date">{{ formatDate(img.uploaded_at) }}</span>
          <span class="table-cell-actions">
            <button class="btn btn-sm btn-outline" @click="openConvertModal(img)">转换</button>
            <button class="btn btn-sm btn-danger" @click="handleDelete(img)">删除</button>
          </span>
        </div>
      </div>

      <!-- Pagination -->
      <div class="pagination">
        <button
          class="btn btn-sm btn-outline"
          :disabled="page <= 1"
          @click="goToPage(page - 1)"
        >
          上一页
        </button>
        <span class="page-info">第 {{ page }} 页 / 共 {{ totalPages }} 页 ({{ total }} 张)</span>
        <button
          class="btn btn-sm btn-outline"
          :disabled="page >= totalPages"
          @click="goToPage(page + 1)"
        >
          下一页
        </button>
      </div>
    </template>

    <!-- Convert Modal -->
    <div v-if="showConvertModal" class="modal-overlay" @click.self="closeConvertModal">
      <div class="modal-content">
        <h4 class="modal-title">格式转换: {{ convertTarget?.filename }}</h4>

        <div v-if="convertError" class="login-error">{{ convertError }}</div>

        <form @submit.prevent="handleConvert">
          <div class="form-group">
            <label for="target-format">目标格式</label>
            <select id="target-format" v-model="convertForm.format" class="form-select">
              <option value="jpg">JPG</option>
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
              <option value="gif">GIF</option>
              <option value="bmp">BMP</option>
            </select>
          </div>

          <div class="form-group">
            <label for="target-quality">
              质量: {{ convertForm.quality }}%
            </label>
            <input
              id="target-quality"
              v-model.number="convertForm.quality"
              type="range"
              min="1"
              max="100"
              class="form-range"
            />
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" @click="closeConvertModal">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="converting">
              {{ converting ? '转换中...' : '开始转换' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchAdminImages, batchDeleteImages, convertImage } from '../../api/admin.js'
import { deleteImage as apiDeleteImage } from '../../api/index.js'

const images = ref([])
const loading = ref(false)
const error = ref('')
const page = ref(1)
const perPage = ref(20)
const total = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / perPage.value)))
const formatFilter = ref('')
const selectedFilenames = ref([])

const allSelected = computed(() => {
  return images.value.length > 0 && selectedFilenames.value.length === images.value.length
})
const someSelected = computed(() => selectedFilenames.value.length > 0)

// Convert modal
const showConvertModal = ref(false)
const convertTarget = ref(null)
const convertError = ref('')
const converting = ref(false)
const convertForm = ref({
  format: 'webp',
  quality: 85,
})

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

async function loadImages() {
  loading.value = true
  error.value = ''
  try {
    const data = await fetchAdminImages(page.value, perPage.value, formatFilter.value)
    images.value = data.images ?? data.items ?? []
    total.value = data.total ?? 0
  } catch (err) {
    error.value = err.message || '加载图片列表失败'
  } finally {
    loading.value = false
  }
}

function goToPage(p) {
  page.value = p
  selectedFilenames.value = []
  loadImages()
}

function onFilterChange() {
  page.value = 1
  selectedFilenames.value = []
  loadImages()
}

function toggleAll(e) {
  if (e.target.checked) {
    selectedFilenames.value = images.value.map(img => img.filename)
  } else {
    selectedFilenames.value = []
  }
}

async function handleDelete(img) {
  if (!confirm(`确定删除「${img.filename}」？此操作不可撤销。`)) return
  try {
    await apiDeleteImage(img.filename)
    selectedFilenames.value = selectedFilenames.value.filter(f => f !== img.filename)
    await loadImages()
  } catch (err) {
    error.value = err.message || '删除失败'
  }
}

async function handleBatchDelete() {
  if (selectedFilenames.value.length === 0) return
  if (!confirm(`确定删除选中的 ${selectedFilenames.value.length} 张图片？此操作不可撤销。`)) return
  try {
    await batchDeleteImages(selectedFilenames.value)
    selectedFilenames.value = []
    await loadImages()
  } catch (err) {
    error.value = err.message || '批量删除失败'
  }
}

function openConvertModal(img) {
  convertTarget.value = img
  convertForm.value = { format: 'webp', quality: 85 }
  convertError.value = ''
  showConvertModal.value = true
}

function closeConvertModal() {
  showConvertModal.value = false
  convertTarget.value = null
  convertError.value = ''
}

async function handleConvert() {
  converting.value = true
  convertError.value = ''
  try {
    await convertImage(convertTarget.value.filename, convertForm.value.format, convertForm.value.quality)
    closeConvertModal()
    await loadImages()
  } catch (err) {
    convertError.value = err.message || '转换失败'
  } finally {
    converting.value = false
  }
}

onMounted(() => {
  loadImages()
})
</script>
