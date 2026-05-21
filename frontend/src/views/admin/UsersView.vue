<template>
  <div class="admin-page">
    <div class="page-header">
      <h3 class="page-title">用户管理</h3>
      <button class="btn btn-primary" @click="openAddModal">添加用户</button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="admin-loading">
      <div class="spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="admin-error">
      <p>{{ error }}</p>
      <button class="btn btn-primary" @click="loadUsers">重试</button>
    </div>

    <!-- Empty -->
    <div v-else-if="users.length === 0" class="empty-text">暂无用户数据</div>

    <!-- Users table -->
    <div v-else class="data-table">
      <div class="table-header">
        <span>用户名</span>
        <span>角色</span>
        <span>创建时间</span>
        <span>操作</span>
      </div>
      <div v-for="u in users" :key="u.id" class="table-row">
        <span>{{ u.username }}</span>
        <span>
          <span class="badge" :class="u.is_admin ? 'badge-admin' : 'badge-user'">
            {{ u.is_admin ? '管理员' : '用户' }}
          </span>
        </span>
        <span class="table-cell-date">{{ formatDate(u.created_at) }}</span>
        <span class="table-cell-actions">
          <button class="btn btn-sm btn-outline" @click="openEditModal(u)">编辑</button>
          <button
            class="btn btn-sm btn-danger"
            :disabled="isSelf(u)"
            @click="handleDelete(u)"
          >
            删除
          </button>
        </span>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h4 class="modal-title">{{ editTarget ? '编辑用户' : '添加用户' }}</h4>

        <div v-if="modalError" class="login-error">{{ modalError }}</div>

        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="form-username">用户名</label>
            <input
              id="form-username"
              v-model="form.username"
              type="text"
              class="form-input"
              required
              autocomplete="off"
            />
          </div>

          <div class="form-group">
            <label for="form-password">密码<span v-if="editTarget" class="form-hint">（留空则不改）</span></label>
            <input
              id="form-password"
              v-model="form.password"
              type="password"
              class="form-input"
              :required="!editTarget"
              autocomplete="new-password"
            />
          </div>

          <div class="form-group">
            <label class="form-checkbox">
              <input v-model="form.is_admin" type="checkbox" />
              管理员
            </label>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" @click="closeModal">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="submitting">
              {{ submitting ? '提交中...' : (editTarget ? '保存' : '创建') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuth } from '../../composables/useAuth.js'
import { fetchUsers, createUser, updateUser, deleteUser } from '../../api/admin.js'

const auth = useAuth()

const users = ref([])
const loading = ref(false)
const error = ref('')

// Modal state
const showModal = ref(false)
const editTarget = ref(null)
const submitting = ref(false)
const modalError = ref('')
const form = ref({
  username: '',
  password: '',
  is_admin: false,
})

function isSelf(u) {
  return auth.user.value && auth.user.value.id === u.id
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

async function loadUsers() {
  loading.value = true
  error.value = ''
  try {
    users.value = await fetchUsers()
  } catch (err) {
    error.value = err.message || '加载用户列表失败'
  } finally {
    loading.value = false
  }
}

function openAddModal() {
  editTarget.value = null
  form.value = { username: '', password: '', is_admin: false }
  modalError.value = ''
  showModal.value = true
}

function openEditModal(u) {
  editTarget.value = u
  form.value = { username: u.username, password: '', is_admin: !!u.is_admin }
  modalError.value = ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editTarget.value = null
  modalError.value = ''
}

async function handleSubmit() {
  submitting.value = true
  modalError.value = ''
  try {
    if (editTarget.value) {
      const data = { username: form.value.username, is_admin: form.value.is_admin }
      if (form.value.password) {
        data.password = form.value.password
      }
      await updateUser(editTarget.value.id, data)
    } else {
      await createUser(form.value.username, form.value.password, form.value.is_admin)
    }
    closeModal()
    await loadUsers()
  } catch (err) {
    modalError.value = err.message || '操作失败'
  } finally {
    submitting.value = false
  }
}

async function handleDelete(u) {
  if (!confirm(`确定删除用户「${u.username}」？此操作不可撤销。`)) return
  try {
    await deleteUser(u.id)
    await loadUsers()
  } catch (err) {
    error.value = err.message || '删除失败'
  }
}

onMounted(() => {
  loadUsers()
})
</script>
