<template>
  <div class="gallery">
    <div v-if="images.length === 0" class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" opacity="0.3">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      <p>还没有图片</p>
      <p>拖放图片到此处，或点击上方按钮上传</p>
    </div>
    <ImageCard
      v-for="(image, index) in images"
      :key="image.filename"
      :image="image"
      @click="$emit('image-click', index)"
      @edit="$emit('image-edit', index)"
      @delete="$emit('image-delete', image)"
    />
  </div>
</template>

<script setup>
import ImageCard from './ImageCard.vue'

defineProps({
  images: { type: Array, default: () => [] }
})

defineEmits(['image-click', 'image-edit', 'image-delete'])
</script>
