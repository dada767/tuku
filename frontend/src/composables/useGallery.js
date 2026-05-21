import { ref } from 'vue'
import { fetchImages as apiFetchImages, uploadImages as apiUploadImages, deleteImage as apiDeleteImage } from '../api/index.js'

export function useGallery() {
  const images = ref([])
  const loading = ref(false)

  async function fetchImages() {
    loading.value = true
    try {
      images.value = await apiFetchImages()
    } catch (err) {
      console.error('Failed to fetch images:', err)
    } finally {
      loading.value = false
    }
  }

  async function uploadImages(files) {
    loading.value = true
    try {
      const uploaded = await apiUploadImages(files)
      // Prepend new images (they will appear at top of sorted list after re-fetch)
      await fetchImages()
      return uploaded
    } catch (err) {
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteImage(filename) {
    await apiDeleteImage(filename)
    images.value = images.value.filter(img => img.filename !== filename)
  }

  return {
    images,
    loading,
    fetchImages,
    uploadImages,
    deleteImage
  }
}
