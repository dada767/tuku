<template>
  <div
    v-if="editor.isOpen.value"
    id="editorOverlay"
    class="editor-overlay open"
    @click.self="handleOverlayClick"
  >
    <!-- Close button -->
    <button class="editor-close" @click="editor.closeEditor">&times;</button>

    <!-- Toolbar -->
    <div id="editorToolbar" class="editor-toolbar">
      <div class="editor-tool-group">
        <button
          v-for="tool in toolGroup1"
          :key="tool.name"
          class="editor-tool-btn"
          :class="{ active: editor.currentTool.value === tool.name }"
          :data-tool="tool.name"
          @click="editor.setTool(tool.name)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <template v-if="tool.name === 'crop'">
              <path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>
            </template>
            <template v-else-if="tool.name === 'rotate'">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </template>
            <template v-else-if="tool.name === 'flip'">
              <line x1="12" y1="3" x2="12" y2="21"/><polyline points="8 8 4 12 8 16"/><polyline points="16 8 20 12 16 16"/>
            </template>
            <template v-else-if="tool.name === 'adjust'">
              <circle cx="12" cy="12" r="3"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/>
            </template>
            <template v-else-if="tool.name === 'filter'">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/>
            </template>
            <template v-else-if="tool.name === 'text'">
              <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
            </template>
            <template v-else-if="tool.name === 'mosaic'">
              <rect x="3" y="3" width="7" height="7" rx="0.5"/><rect x="14" y="3" width="7" height="7" rx="0.5"/><rect x="3" y="14" width="7" height="7" rx="0.5"/><rect x="14" y="14" width="7" height="7" rx="0.5"/>
            </template>
            <template v-else-if="tool.name === 'watermark'">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M12 6v6l4 2"/>
            </template>
          </svg>
          {{ tool.label }}
        </button>
      </div>
      <div class="editor-tool-group">
        <button
          class="editor-tool-btn"
          :disabled="editor.undoDisabled.value"
          @click="editor.undo"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
          </svg>
          撤销
        </button>
        <button
          class="editor-tool-btn"
          :disabled="editor.redoDisabled.value"
          @click="editor.redo"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          重做
        </button>
      </div>
    </div>

    <!-- Settings panel -->
    <div
      id="editorSettings"
      ref="settingsPanelRef"
      class="editor-settings"
      :class="{ visible: editor.currentTool.value !== null }"
      v-html="settingsHtml"
    ></div>

    <!-- Canvas area -->
    <div class="editor-canvas-area">
      <div class="editor-canvas-wrap">
        <canvas
          id="editorCanvas"
          ref="editorCanvasRef"
        ></canvas>
        <canvas
          id="editorOverlayCanvas"
          ref="editorOverlayCanvasRef"
        ></canvas>
      </div>

      <!-- Loading overlay -->
      <div id="editorLoading" class="editor-loading" :class="{ visible: editor.isLoading.value }">
        <div class="spinner"></div>
        <span>正在处理...</span>
      </div>
    </div>

    <!-- Bottom bar -->
    <div id="editorBottombar" class="editor-bottombar">
      <span id="editorFilename" class="editor-filename">{{ editor.originalFilename.value }}</span>
      <div class="editor-bottombar-actions">
        <button class="btn btn-ghost" @click="editor.closeEditor">取消</button>
        <button class="btn btn-primary" @click="editor.saveAsCopy">保存副本</button>
        <button class="btn btn-primary" @click="editor.overwriteOriginal">覆盖原图</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted, inject } from 'vue'
import { useEditor } from '../composables/useEditor.js'

// Inject reactive state from App.vue
const galleryImages = inject('galleryImages')
const showToast = inject('showToast')
const fetchImages = inject('fetchImages')

// Create editor instance
const editor = useEditor({
  images: galleryImages,
  showToast,
  fetchImages
})

// Template refs
const editorCanvasRef = ref(null)
const editorOverlayCanvasRef = ref(null)
const settingsPanelRef = ref(null)

// Wire canvas refs to the editor composable
watch(editorCanvasRef, (el) => { editor.canvasEl.value = el })
watch(editorOverlayCanvasRef, (el) => { editor.overlayCanvasEl.value = el })

onMounted(() => {
  if (editorCanvasRef.value) editor.canvasEl.value = editorCanvasRef.value
  if (editorOverlayCanvasRef.value) editor.overlayCanvasEl.value = editorOverlayCanvasRef.value
})

// Tool button definitions
const toolGroup1 = [
  { name: 'crop', label: '裁剪' },
  { name: 'rotate', label: '旋转' },
  { name: 'flip', label: '翻转' },
  { name: 'adjust', label: '调整' },
  { name: 'filter', label: '滤镜' },
  { name: 'text', label: '文字' },
  { name: 'mosaic', label: '马赛克' },
  { name: 'watermark', label: '去水印' }
]

// Dynamic settings HTML
const settingsHtml = ref('')

// Watch currentTool to update settings panel
watch(() => editor.currentTool.value, (tool) => {
  if (tool) {
    settingsHtml.value = editor.buildSettingsPanel(tool)
    nextTick(() => {
      if (settingsPanelRef.value) {
        editor.bindSettingsEvents(tool, settingsPanelRef.value)
      }
    })
  } else {
    settingsHtml.value = ''
  }
})

// Keyboard handling
function onKeydown(e) {
  editor.handleKeydown(e)
}

watch(() => editor.isOpen.value, (val) => {
  if (val) {
    document.addEventListener('keydown', onKeydown)
    // Re-wire canvas refs (they may have been reset)
    nextTick(() => {
      if (editorCanvasRef.value) editor.canvasEl.value = editorCanvasRef.value
      if (editorOverlayCanvasRef.value) editor.overlayCanvasEl.value = editorOverlayCanvasRef.value
    })
  } else {
    document.removeEventListener('keydown', onKeydown)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})

function handleOverlayClick(e) {
  if (e.target === e.currentTarget) {
    editor.closeEditor()
  }
}

// Expose editor to parent via defineExpose
defineExpose({ editor })
</script>
