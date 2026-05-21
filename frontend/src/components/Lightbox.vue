<template>
  <div
    v-if="isOpen"
    class="lightbox open"
    @click.self="$emit('close')"
  >
    <button class="lightbox-close" @click="$emit('close')">&times;</button>

    <button
      v-if="hasPrev"
      class="lightbox-prev"
      @click.stop="$emit('prev')"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>

    <img
      v-if="currentImage"
      class="lightbox-img"
      :class="{ fading: fading }"
      :src="currentImage.url"
      :alt="currentImage.filename"
    />

    <button
      v-if="hasNext"
      class="lightbox-next"
      @click.stop="$emit('next')"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>

    <div class="lightbox-counter">{{ currentIndex + 1 }} / {{ total }}</div>
  </div>
</template>

<script setup>
defineProps({
  isOpen: { type: Boolean, default: false },
  currentImage: { type: Object, default: null },
  currentIndex: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  hasPrev: { type: Boolean, default: false },
  hasNext: { type: Boolean, default: false },
  fading: { type: Boolean, default: false }
})

defineEmits(['close', 'prev', 'next'])
</script>
