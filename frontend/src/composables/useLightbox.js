import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

export function useLightbox(images) {
  const isOpen = ref(false)
  const currentIndex = ref(0)
  const fading = ref(false)

  const currentImage = computed(() => {
    if (!isOpen.value || images.value.length === 0) return null
    return images.value[currentIndex.value] || null
  })

  const totalImages = computed(() => images.value.length)

  const hasPrev = computed(() => currentIndex.value > 0)
  const hasNext = computed(() => currentIndex.value < images.value.length - 1)

  function open(index) {
    currentIndex.value = index
    isOpen.value = true
    fading.value = false
  }

  function close() {
    isOpen.value = false
  }

  function prev() {
    if (!hasPrev.value) return
    fading.value = true
    setTimeout(() => {
      currentIndex.value--
      fading.value = false
    }, 200)
  }

  function next() {
    if (!hasNext.value) return
    fading.value = true
    setTimeout(() => {
      currentIndex.value++
      fading.value = false
    }, 200)
  }

  function handleKeydown(e) {
    if (!isOpen.value) return
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'ArrowLeft':
        e.preventDefault()
        prev()
        break
      case 'ArrowRight':
        e.preventDefault()
        next()
        break
    }
  }

  watch(isOpen, (val) => {
    if (val) {
      document.addEventListener('keydown', handleKeydown)
      document.body.style.overflow = 'hidden'
    } else {
      document.removeEventListener('keydown', handleKeydown)
      document.body.style.overflow = ''
    }
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = ''
  })

  return {
    isOpen,
    currentIndex,
    currentImage,
    totalImages,
    hasPrev,
    hasNext,
    fading,
    open,
    close,
    prev,
    next
  }
}
