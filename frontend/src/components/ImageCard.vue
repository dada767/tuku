<template>
  <div class="card" @click="$emit('click')">
    <div class="card-img-wrap">
      <img
        class="card-img"
        :src="image.url"
        :alt="image.filename"
        loading="lazy"
      />
      <div class="card-overlay">
        <button
          class="card-edit"
          title="编辑"
          @click.stop="$emit('edit')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button
          class="card-delete"
          title="删除"
          @click.stop="$emit('delete')"
        >
          &times;
        </button>
      </div>
    </div>
    <div class="card-info">
      <span class="card-filename">{{ image.filename }}</span>
      <span class="card-size">{{ formatSize(image.size) }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  image: { type: Object, required: true }
})

defineEmits(['click', 'edit', 'delete'])

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>
