<template>
  <div>
    <router-view />
    <ToastContainer :toasts="toasts" />
  </div>
</template>

<script setup>
import ToastContainer from './components/ToastContainer.vue'
import { useToast } from './composables/useToast.js'

const { toasts } = useToast()
</script>
