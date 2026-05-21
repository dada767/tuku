<template>
  <div>
    <AppHeader
      :image-count="images.length"
      @upload-click="triggerFileInput"
    />

    <GalleryGrid
      :images="images"
      @image-click="lightbox.open"
      @image-edit="openEditor"
      @image-delete="handleDelete"
    />

    <DropZone :is-active="isDragging" />

    <Lightbox
      :is-open="lightbox.isOpen.value"
      :current-image="lightbox.currentImage.value"
      :current-index="lightbox.currentIndex.value"
      :total="lightbox.totalImages.value"
      :has-prev="lightbox.hasPrev.value"
      :has-next="lightbox.hasNext.value"
      :fading="lightbox.fading.value"
      @close="lightbox.close"
      @prev="lightbox.prev"
      @next="lightbox.next"
    />

    <EditorView ref="editorViewRef" />

    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      multiple
      accept="image/*"
      style="display: none"
      @change="onFileInputChange"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, provide } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import GalleryGrid from '../components/GalleryGrid.vue'
import DropZone from '../components/DropZone.vue'
import Lightbox from '../components/Lightbox.vue'
import EditorView from './EditorView.vue'
import { useGallery } from '../composables/useGallery.js'
import { useLightbox } from '../composables/useLightbox.js'
import { useToast } from '../composables/useToast.js'

const { images, fetchImages, uploadImages, deleteImage } = useGallery()
const lightbox = useLightbox(images)
const { showToast } = useToast()

// Provide core reactive state so EditorView can inject them
provide('galleryImages', images)
provide('showToast', showToast)
provide('fetchImages', fetchImages)

const isDragging = ref(false)
const fileInputRef = ref(null)
const editorViewRef = ref(null)

let dragCounter = 0

function openEditor(index) {
  if (editorViewRef.value && editorViewRef.value.editor) {
    editorViewRef.value.editor.openEditor(index)
  }
}

async function handleDelete(image) {
  if (!confirm(`确定删除 ${image.filename}？`)) return
  try {
    await deleteImage(image.filename)
    showToast('删除成功', 'success')
  } catch (err) {
    showToast('删除失败: ' + err.message, 'error')
  }
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

async function onFileInputChange(e) {
  const files = e.target.files
  if (!files || files.length === 0) return
  try {
    await uploadImages(files)
    showToast(`成功上传 ${files.length} 张图片`, 'success')
  } catch (err) {
    showToast('上传失败: ' + err.message, 'error')
  }
  e.target.value = ''
}

// Drag & drop event handlers for full window
function onDragEnter(e) {
  e.preventDefault()
  dragCounter++
  if (dragCounter === 1) {
    isDragging.value = true
  }
}

function onDragOver(e) {
  e.preventDefault()
}

function onDragLeave(e) {
  e.preventDefault()
  dragCounter--
  if (dragCounter === 0) {
    isDragging.value = false
  }
}

async function onDrop(e) {
  e.preventDefault()
  dragCounter = 0
  isDragging.value = false

  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  try {
    await uploadImages(files)
    showToast(`成功上传 ${files.length} 张图片`, 'success')
  } catch (err) {
    showToast('上传失败: ' + err.message, 'error')
  }
}

onMounted(() => {
  fetchImages()

  document.addEventListener('dragenter', onDragEnter)
  document.addEventListener('dragover', onDragOver)
  document.addEventListener('dragleave', onDragLeave)
  document.addEventListener('drop', onDrop)
})

onUnmounted(() => {
  document.removeEventListener('dragenter', onDragEnter)
  document.removeEventListener('dragover', onDragOver)
  document.removeEventListener('dragleave', onDragLeave)
  document.removeEventListener('drop', onDrop)
})
</script>
