import { ref } from 'vue'

const toasts = ref([])
let idCounter = 0

export function useToast() {
  function showToast(message, type = '') {
    const id = ++idCounter
    toasts.value.push({ id, message, type, removing: false })

    setTimeout(() => {
      const toast = toasts.value.find(t => t.id === id)
      if (toast) {
        toast.removing = true
        setTimeout(() => {
          toasts.value = toasts.value.filter(t => t.id !== id)
        }, 300)
      }
    }, 3000)
  }

  function removeToast(id) {
    const toast = toasts.value.find(t => t.id === id)
    if (toast) {
      toast.removing = true
      setTimeout(() => {
        toasts.value = toasts.value.filter(t => t.id !== id)
      }, 300)
    }
  }

  return {
    toasts,
    showToast,
    removeToast
  }
}
