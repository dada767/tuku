<template>
  <div class="toast-container">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast"
      :class="[toast.type, { removing: toast.removing }]"
    >
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup>
defineProps({
  toasts: { type: Array, default: () => [] }
})
</script>
