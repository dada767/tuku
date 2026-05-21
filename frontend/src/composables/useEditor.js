import { ref, reactive, computed, nextTick } from 'vue'
import { inpaintImage as apiInpaint, saveEdited as apiSaveEdited } from '../api/index.js'

/**
 * Canvas-based Image Editor - Vue 3 composable
 * Ported 1:1 from editor.js
 *
 * @param {Object} options
 * @param {import('vue').Ref<Array>} options.images - Reactive images array from useGallery
 * @param {Function} options.showToast - Toast function from useToast
 * @param {Function} options.fetchImages - Image refresh function from useGallery
 */
export function useEditor({ images, showToast, fetchImages }) {
  // =========================================================================
  // 1. CANVAS ELEMENT REFS (set by EditorView via template refs)
  // =========================================================================
  const canvasEl = ref(null)       // Main editor canvas
  const overlayCanvasEl = ref(null) // Overlay canvas for crop/watermark

  // =========================================================================
  // 2. INTERNAL NON-REACTIVE CANVAS STATE (set during initCanvas)
  // =========================================================================
  let canvas = null
  let ctx = null
  let overlayCanvas = null
  let overlayCtx = null
  let maskCanvas = null
  let maskCtx = null

  // =========================================================================
  // 3. REACTIVE EDITOR STATE
  // =========================================================================
  const isOpen = ref(false)
  const imageIndex = ref(-1)
  const originalFilename = ref('')
  const originalImage = ref(null)
  const displayWidth = ref(0)
  const displayHeight = ref(0)
  const origWidth = ref(0)
  const origHeight = ref(0)
  const scaleX = ref(1.0)
  const scaleY = ref(1.0)
  const currentTool = ref(null)
  const isDirty = ref(false)
  const isLoading = ref(false)
  const freeAngle = ref(0)

  // Crop state
  const crop = reactive({
    active: false,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    dragging: false,
    aspectRatio: null
  })

  // Brush state
  const brush = reactive({
    isDrawing: false,
    size: 20,
    lastX: 0,
    lastY: 0
  })

  // Mosaic state
  const mosaicBlockSize = ref(15)
  const mosaicDrawing = ref(false)

  // Filter/adjust values
  const filterValues = reactive({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    vibrance: 0,
    temperature: 0,
    clarity: 0,
    highlights: 0,
    shadows: 0
  })
  const activeFilter = ref(null)

  // Text state
  const textState = reactive({
    content: '',
    fontSize: 48,
    color: '#ffffff'
  })

  // Text shadow state
  const textShadow = reactive({
    enabled: false,
    color: '#000000',
    blur: 3,
    offsetX: 3,
    offsetY: 3
  })
  })

  // History
  const history = ref([])
  const historyIndex = ref(-1)

  // Undo/Redo disabled states (computed for binding in template)
  const undoDisabled = computed(() => historyIndex.value <= 0)
  const redoDisabled = computed(() => historyIndex.value >= history.value.length - 1)

  // Bound event handlers (stored for unbinding)
  let _boundHandlers = null

  // Loaded settings event listeners (stored for cleanup)
  let _settingsCleanup = null

  // =========================================================================
  // 4. UTILITY FUNCTIONS
  // =========================================================================

  function pushHistory() {
    if (!ctx) return
    // Truncate forward history
    history.value = history.value.slice(0, historyIndex.value + 1)
    const imageData = ctx.getImageData(0, 0, displayWidth.value, displayHeight.value)
    history.value.push(imageData)
    historyIndex.value = history.value.length - 1
    // Cap at 30 entries
    if (history.value.length > 30) {
      history.value.shift()
      historyIndex.value = history.value.length - 1
    }
  }

  function undo() {
    if (historyIndex.value <= 0) return
    historyIndex.value--
    const imageData = history.value[historyIndex.value]
    if (imageData && ctx) {
      ctx.putImageData(imageData, 0, 0)
    }
    isDirty.value = true
  }

  function redo() {
    if (historyIndex.value >= history.value.length - 1) return
    historyIndex.value++
    const imageData = history.value[historyIndex.value]
    if (imageData && ctx) {
      ctx.putImageData(imageData, 0, 0)
    }
    isDirty.value = true
  }

  function redrawCanvas() {
    if (!ctx || !originalImage.value) return
    ctx.clearRect(0, 0, displayWidth.value, displayHeight.value)
    ctx.drawImage(originalImage.value, 0, 0, displayWidth.value, displayHeight.value)
  }

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect()
    let clientX, clientY
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX
      clientY = e.changedTouches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    }
  }

  function bakeFilter() {
    if (!ctx) return
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = displayWidth.value
    tempCanvas.height = displayHeight.value
    const tempCtx = tempCanvas.getContext('2d')
    tempCtx.drawImage(canvas, 0, 0)
    ctx.filter = 'none'
    ctx.clearRect(0, 0, displayWidth.value, displayHeight.value)
    ctx.drawImage(tempCanvas, 0, 0)
    activeFilter.value = null
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  // =========================================================================
  // 5. CANVAS EVENT BINDING / UNBINDING
  // =========================================================================

  function bindCanvasEvents(handlers) {
    unbindCanvasEvents()
    if (!handlers) return
    if (handlers.mousedown) {
      canvas.addEventListener('mousedown', handlers.mousedown)
      canvas.addEventListener('touchstart', handlers.touchstart || handlers.mousedown, { passive: false })
    }
    if (handlers.mousemove) {
      window.addEventListener('mousemove', handlers.mousemove)
      window.addEventListener('touchmove', handlers.touchmove || handlers.mousemove, { passive: false })
    }
    if (handlers.mouseup) {
      window.addEventListener('mouseup', handlers.mouseup)
      window.addEventListener('touchend', handlers.touchend || handlers.mouseup)
    }
    _boundHandlers = handlers
  }

  function unbindCanvasEvents() {
    const handlers = _boundHandlers
    if (!handlers) return
    if (handlers.mousedown) {
      canvas.removeEventListener('mousedown', handlers.mousedown)
      canvas.removeEventListener('touchstart', handlers.touchstart || handlers.mousedown)
    }
    if (handlers.mousemove) {
      window.removeEventListener('mousemove', handlers.mousemove)
      window.removeEventListener('touchmove', handlers.touchmove || handlers.mousemove)
    }
    if (handlers.mouseup) {
      window.removeEventListener('mouseup', handlers.mouseup)
      window.removeEventListener('touchend', handlers.touchend || handlers.mouseup)
    }
    _boundHandlers = null
  }

  // =========================================================================
  // 6. FLIP & ROTATE
  // =========================================================================

  function flipHorizontal() {
    if (!ctx) return
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = displayWidth.value
    tempCanvas.height = displayHeight.value
    const tempCtx = tempCanvas.getContext('2d')
    tempCtx.translate(displayWidth.value, 0)
    tempCtx.scale(-1, 1)
    tempCtx.drawImage(canvas, 0, 0)
    ctx.clearRect(0, 0, displayWidth.value, displayHeight.value)
    ctx.drawImage(tempCanvas, 0, 0)
    pushHistory()
    isDirty.value = true
  }

  function flipVertical() {
    if (!ctx) return
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = displayWidth.value
    tempCanvas.height = displayHeight.value
    const tempCtx = tempCanvas.getContext('2d')
    tempCtx.translate(0, displayHeight.value)
    tempCtx.scale(1, -1)
    tempCtx.drawImage(canvas, 0, 0)
    ctx.clearRect(0, 0, displayWidth.value, displayHeight.value)
    ctx.drawImage(tempCanvas, 0, 0)
    pushHistory()
    isDirty.value = true
  }

  function rotate90(direction) {
    if (!ctx) return
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = displayWidth.value
    tempCanvas.height = displayHeight.value
    const tempCtx = tempCanvas.getContext('2d')
    tempCtx.drawImage(canvas, 0, 0)

    // Swap dimensions
    const newW = displayHeight.value
    const newH = displayWidth.value
    canvas.width = newW
    canvas.height = newH
    displayWidth.value = newW
    displayHeight.value = newH
    overlayCanvas.width = newW
    overlayCanvas.height = newH

    ctx = canvas.getContext('2d')
    overlayCtx = overlayCanvas.getContext('2d')

    ctx.save()
    ctx.translate(newW / 2, newH / 2)
    if (direction === 'cw') {
      ctx.rotate(Math.PI / 2)
    } else {
      ctx.rotate(-Math.PI / 2)
    }
    ctx.drawImage(tempCanvas, -tempCanvas.width / 2, -tempCanvas.height / 2)
    ctx.restore()

    scaleX.value = origWidth.value / displayWidth.value
    scaleY.value = origHeight.value / displayHeight.value

    pushHistory()
    isDirty.value = true
  }

  function rotateFree(angle) {
    if (!ctx) return
    const radians = (angle * Math.PI) / 180

    // Save current content
    const oldCanvas = document.createElement('canvas')
    oldCanvas.width = displayWidth.value
    oldCanvas.height = displayHeight.value
    const oldCtx = oldCanvas.getContext('2d')
    oldCtx.drawImage(canvas, 0, 0)

    const w = displayWidth.value
    const h = displayHeight.value
    const cos = Math.abs(Math.cos(radians))
    const sin = Math.abs(Math.sin(radians))
    const newW = Math.ceil(w * cos + h * sin)
    const newH = Math.ceil(w * sin + h * cos)

    canvas.width = newW
    canvas.height = newH
    displayWidth.value = newW
    displayHeight.value = newH
    overlayCanvas.width = newW
    overlayCanvas.height = newH

    ctx = canvas.getContext('2d')
    overlayCtx = overlayCanvas.getContext('2d')

    ctx.save()
    ctx.translate(newW / 2, newH / 2)
    ctx.rotate(radians)
    ctx.drawImage(oldCanvas, -w / 2, -h / 2)
    ctx.restore()

    scaleX.value = origWidth.value / displayWidth.value
    scaleY.value = origHeight.value / displayHeight.value

    pushHistory()
    isDirty.value = true
  }

  // =========================================================================
  // 7. CROP TOOL
  // =========================================================================

  function activateCrop() {
    crop.active = false
    crop.dragging = false
    crop.startX = 0
    crop.startY = 0
    crop.endX = 0
    crop.endY = 0
    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, displayWidth.value, displayHeight.value)
    }
    if (overlayCanvas) {
      overlayCanvas.style.display = 'block'
      overlayCanvas.style.cursor = 'crosshair'
    }

    bindCanvasEvents({
      mousedown: cropMouseDown,
      mousemove: cropMouseMove,
      mouseup: cropMouseUp,
      touchstart: function(e) { e.preventDefault(); cropMouseDown(e) },
      touchmove: function(e) { e.preventDefault(); cropMouseMove(e) },
      touchend: cropMouseUp
    })
  }

  function cropMouseDown(e) {
    e.preventDefault()
    const coords = getCanvasCoords(e)
    crop.active = true
    crop.dragging = true
    crop.startX = coords.x
    crop.startY = coords.y
    crop.endX = coords.x
    crop.endY = coords.y
  }

  function cropMouseMove(e) {
    if (!crop.dragging) return
    const coords = getCanvasCoords(e)
    let ex = Math.max(0, Math.min(coords.x, displayWidth.value))
    let ey = Math.max(0, Math.min(coords.y, displayHeight.value))

    if (crop.aspectRatio) {
      let w = ex - crop.startX
      let h = ey - crop.startY
      let absW = Math.abs(w)
      let absH = Math.abs(h)
      const ratio = crop.aspectRatio

      if (absW / absH > ratio) {
        absW = absH * ratio
      } else {
        absH = absW / ratio
      }
      ex = crop.startX + (w >= 0 ? Math.abs(absW) : -Math.abs(absW))
      ey = crop.startY + (h >= 0 ? Math.abs(absH) : -Math.abs(absH))
    }

    crop.endX = Math.max(0, Math.min(ex, displayWidth.value))
    crop.endY = Math.max(0, Math.min(ey, displayHeight.value))
    drawCropOverlay()
  }

  function cropMouseUp() {
    if (crop.dragging) {
      const sx = Math.min(crop.startX, crop.endX)
      const sy = Math.min(crop.startY, crop.endY)
      const ex = Math.max(crop.startX, crop.endX)
      const ey = Math.max(crop.startY, crop.endY)
      crop.startX = sx
      crop.startY = sy
      crop.endX = ex
      crop.endY = ey
    }
    crop.dragging = false
  }

  function drawCropOverlay() {
    if (!overlayCtx) return
    overlayCtx.clearRect(0, 0, displayWidth.value, displayHeight.value)

    const sx = Math.min(crop.startX, crop.endX)
    const sy = Math.min(crop.startY, crop.endY)
    const ex = Math.max(crop.startX, crop.endX)
    const ey = Math.max(crop.startY, crop.endY)
    const w = ex - sx
    const h = ey - sy

    // Semi-transparent overlay
    overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    overlayCtx.fillRect(0, 0, displayWidth.value, displayHeight.value)
    overlayCtx.clearRect(sx, sy, w, h)

    // Crop outline (marching ants effect simplified)
    overlayCtx.strokeStyle = '#ffffff'
    overlayCtx.lineWidth = 1.5
    overlayCtx.setLineDash([6, 3])
    overlayCtx.strokeRect(sx, sy, w, h)
    overlayCtx.setLineDash([])

    // Corner handles
    overlayCtx.fillStyle = '#ffffff'
    const handleSize = 6
    ;[
      [sx, sy],
      [sx + w, sy],
      [sx, sy + h],
      [sx + w, sy + h]
    ].forEach((pt) => {
      overlayCtx.fillRect(pt[0] - handleSize / 2, pt[1] - handleSize / 2, handleSize, handleSize)
    })
  }

  function applyCrop() {
    const sx = Math.min(crop.startX, crop.endX)
    const sy = Math.min(crop.startY, crop.endY)
    const ex = Math.max(crop.startX, crop.endX)
    const ey = Math.max(crop.startY, crop.endY)
    const cropW = ex - sx
    const cropH = ey - sy

    if (cropW < 1 || cropH < 1) return

    const tempCanvas = document.createElement('canvas')
    const imgData = ctx.getImageData(sx, sy, cropW, cropH)
    tempCanvas.width = cropW
    tempCanvas.height = cropH
    tempCanvas.getContext('2d').putImageData(imgData, 0, 0)

    canvas.width = cropW
    canvas.height = cropH
    displayWidth.value = cropW
    displayHeight.value = cropH
    overlayCanvas.width = cropW
    overlayCanvas.height = cropH

    ctx = canvas.getContext('2d')
    overlayCtx = overlayCanvas.getContext('2d')

    ctx.drawImage(tempCanvas, 0, 0)

    scaleX.value = origWidth.value / displayWidth.value
    scaleY.value = origHeight.value / displayHeight.value

    cancelCropInternal()
    pushHistory()
    isDirty.value = true
  }

  function cancelCrop() {
    cancelCropInternal()
    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, displayWidth.value, displayHeight.value)
    }
  }

  function cancelCropInternal() {
    crop.active = false
    crop.dragging = false
    crop.startX = 0
    crop.startY = 0
    crop.endX = 0
    crop.endY = 0
    unbindCanvasEvents()
    if (overlayCanvas) {
      overlayCanvas.style.cursor = ''
    }
  }

  // =========================================================================
  // 8. ADJUST TOOL (brightness / contrast / saturation)
  // =========================================================================

  let _adjustCallbacks = null

  function activateAdjust() {
    // Store callbacks for settings panel binding
    _adjustCallbacks = {
      onSliderInput() {
        const b = filterValues.brightness
        const c = filterValues.contrast
        const s = filterValues.saturation
        if (ctx) {
          ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`
          ctx.clearRect(0, 0, displayWidth.value, displayHeight.value)
          ctx.drawImage(originalImage.value, 0, 0, displayWidth.value, displayHeight.value)
        }
      },
      onSliderChange() {
        bakeFilter()
        pushHistory()
        isDirty.value = true
        // Re-apply filter for continued editing
        if (_adjustCallbacks) _adjustCallbacks.onSliderInput()
      }
    }
  }

  function resetAdjust() {
    filterValues.brightness = 100
    filterValues.contrast = 100
    filterValues.saturation = 100
    if (ctx) {
      ctx.filter = 'none'
    }
    redrawCanvas()
    pushHistory()
    isDirty.value = true
  }

  // =========================================================================
  // 9. FILTER TOOL
  // =========================================================================

  function applyFilter(filterType) {
    if (!ctx) return

    switch (filterType) {
      case 'grayscale':
        ctx.filter = 'grayscale(1)'
        ctx.clearRect(0, 0, displayWidth.value, displayHeight.value)
        ctx.drawImage(originalImage.value, 0, 0, displayWidth.value, displayHeight.value)
        bakeFilter()
        break

      case 'sepia':
        ctx.filter = 'sepia(1)'
        ctx.clearRect(0, 0, displayWidth.value, displayHeight.value)
        ctx.drawImage(originalImage.value, 0, 0, displayWidth.value, displayHeight.value)
        bakeFilter()
        break

      case 'invert':
        ctx.filter = 'invert(1)'
        ctx.clearRect(0, 0, displayWidth.value, displayHeight.value)
        ctx.drawImage(originalImage.value, 0, 0, displayWidth.value, displayHeight.value)
        bakeFilter()
        break

      case 'blur':
        ctx.filter = 'blur(4px)'
        ctx.clearRect(0, 0, displayWidth.value, displayHeight.value)
        ctx.drawImage(originalImage.value, 0, 0, displayWidth.value, displayHeight.value)
        bakeFilter()
        break

      case 'sharpen':
        applySharpen()
        break

      default:
        break
    }

    pushHistory()
    isDirty.value = true
  }

  function applySharpen() {
    const imageData = ctx.getImageData(0, 0, displayWidth.value, displayHeight.value)
    const data = imageData.data
    const w = displayWidth.value
    const h = displayHeight.value
    const output = new Uint8ClampedArray(data.length)

    const kernel = [
      [0, -1, 0],
      [-1, 5, -1],
      [0, -1, 0]
    ]

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let r = 0, g = 0, b = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * w + (x + kx)) * 4
            const kVal = kernel[ky + 1][kx + 1]
            r += data[idx] * kVal
            g += data[idx + 1] * kVal
            b += data[idx + 2] * kVal
          }
        }
        const outIdx = (y * w + x) * 4
        output[outIdx] = Math.min(255, Math.max(0, r))
        output[outIdx + 1] = Math.min(255, Math.max(0, g))
        output[outIdx + 2] = Math.min(255, Math.max(0, b))
        output[outIdx + 3] = data[outIdx + 3]
      }
    }

    // Copy edges
    for (let y = 0; y < h; y++) {
      const idx = y * w * 4
      output[idx] = data[idx]
      output[idx + 1] = data[idx + 1]
      output[idx + 2] = data[idx + 2]
      output[idx + 3] = data[idx + 3]
      const eidx = (y * w + w - 1) * 4
      output[eidx] = data[eidx]
      output[eidx + 1] = data[eidx + 1]
      output[eidx + 2] = data[eidx + 2]
      output[eidx + 3] = data[eidx + 3]
    }
    for (let x = 0; x < w; x++) {
      const tidx = x * 4
      output[tidx] = data[tidx]
      output[tidx + 1] = data[tidx + 1]
      output[tidx + 2] = data[tidx + 2]
      output[tidx + 3] = data[tidx + 3]
      const bidx = ((h - 1) * w + x) * 4
      output[bidx] = data[bidx]
      output[bidx + 1] = data[bidx + 1]
      output[bidx + 2] = data[bidx + 2]
      output[bidx + 3] = data[bidx + 3]
    }

    imageData.data.set(output)
    ctx.putImageData(imageData, 0, 0)
  }

  // =========================================================================
  // 10. MOSAIC (PIXELATE) TOOL
  // =========================================================================

  function activateMosaic() {
    mosaicDrawing.value = false
    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, displayWidth.value, displayHeight.value)
    }
    if (overlayCanvas) {
      overlayCanvas.style.display = 'block'
      overlayCanvas.style.cursor = 'crosshair'
    }
    bindCanvasEvents({
      mousedown: mosaicMouseDown,
      mousemove: mosaicMouseMove,
      mouseup: mosaicMouseUp,
      touchstart: function(e) { e.preventDefault(); mosaicMouseDown(e) },
      touchmove: function(e) { e.preventDefault(); mosaicMouseMove(e) },
      touchend: mosaicMouseUp
    })
  }

  function mosaicMouseDown(e) {
    e.preventDefault()
    mosaicDrawing.value = true
    const coords = getCanvasCoords(e)
    brush.lastX = coords.x
    brush.lastY = coords.y
    applyMosaicAt(coords.x, coords.y, brush.size, mosaicBlockSize.value)
    drawMosaicBrushOverlay(coords.x, coords.y)
  }

  function mosaicMouseMove(e) {
    if (!mosaicDrawing.value) return
    const coords = getCanvasCoords(e)
    // Draw line of mosaic blocks between last point and current
    const dx = coords.x - brush.lastX
    const dy = coords.y - brush.lastY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const step = mosaicBlockSize.value * 0.5
    if (dist > step) {
      const steps = Math.ceil(dist / step)
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        const ix = brush.lastX + dx * t
        const iy = brush.lastY + dy * t
        applyMosaicAt(ix, iy, brush.size, mosaicBlockSize.value)
      }
    } else {
      applyMosaicAt(coords.x, coords.y, brush.size, mosaicBlockSize.value)
    }
    brush.lastX = coords.x
    brush.lastY = coords.y
    drawMosaicBrushOverlay(coords.x, coords.y)
  }

  function mosaicMouseUp() {
    if (mosaicDrawing.value) {
      pushHistory()
      isDirty.value = true
    }
    mosaicDrawing.value = false
  }

  function applyMosaicAt(cx, cy, brushSize, blockSize) {
    if (!ctx) return
    const x = Math.max(0, Math.floor(cx - brushSize / 2))
    const y = Math.max(0, Math.floor(cy - brushSize / 2))
    const w = Math.min(displayWidth.value - x, brushSize)
    const h = Math.min(displayHeight.value - y, brushSize)
    if (w <= 0 || h <= 0) return

    const imageData = ctx.getImageData(x, y, w, h)
    const data = imageData.data

    for (let by = 0; by < h; by += blockSize) {
      for (let bx = 0; bx < w; bx += blockSize) {
        const bw = Math.min(blockSize, w - bx)
        const bh = Math.min(blockSize, h - by)
        let r = 0, g = 0, b = 0, count = 0
        for (let py = 0; py < bh; py++) {
          for (let px = 0; px < bw; px++) {
            const idx = ((by + py) * w + (bx + px)) * 4
            r += data[idx]; g += data[idx + 1]; b += data[idx + 2]
            count++
          }
        }
        r = Math.round(r / count)
        g = Math.round(g / count)
        b = Math.round(b / count)
        for (let py = 0; py < bh; py++) {
          for (let px = 0; px < bw; px++) {
            const idx = ((by + py) * w + (bx + px)) * 4
            data[idx] = r; data[idx + 1] = g; data[idx + 2] = b
          }
        }
      }
    }
    ctx.putImageData(imageData, x, y)
  }

  function drawMosaicBrushOverlay(cx, cy) {
    if (!overlayCtx) return
    overlayCtx.clearRect(0, 0, displayWidth.value, displayHeight.value)
    overlayCtx.beginPath()
    overlayCtx.arc(cx, cy, brush.size / 2, 0, Math.PI * 2)
    overlayCtx.fillStyle = 'rgba(59, 130, 246, 0.25)'
    overlayCtx.fill()
    overlayCtx.strokeStyle = 'rgba(59, 130, 246, 0.6)'
    overlayCtx.lineWidth = 1.5
    overlayCtx.stroke()
  }

  // =========================================================================
  // 10b. ADVANCED ADJUSTMENTS (pixel-level)
  // =========================================================================

  function applyVibrance(amount) {
    if (!ctx || amount === 0) return
    const imageData = ctx.getImageData(0, 0, displayWidth.value, displayHeight.value)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const saturation = max - min
      const avg = (r + g + b) / 3
      const factor = amount * (1 - Math.min(1, saturation / 255)) / 100
      data[i] = Math.min(255, Math.max(0, r + (r - avg) * factor))
      data[i + 1] = Math.min(255, Math.max(0, g + (g - avg) * factor))
      data[i + 2] = Math.min(255, Math.max(0, b + (b - avg) * factor))
    }
    ctx.putImageData(imageData, 0, 0)
  }

  function applyTemperature(amount) {
    if (!ctx || amount === 0) return
    const imageData = ctx.getImageData(0, 0, displayWidth.value, displayHeight.value)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] + amount))
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] - amount))
    }
    ctx.putImageData(imageData, 0, 0)
  }

  function applyClarity(amount) {
    if (!ctx || amount === 0) return
    const intensity = amount / 40
    const imageData = ctx.getImageData(0, 0, displayWidth.value, displayHeight.value)
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = displayWidth.value
    tempCanvas.height = displayHeight.value
    const tempCtx = tempCanvas.getContext('2d')
    tempCtx.putImageData(imageData, 0, 0)
    tempCtx.filter = 'blur(3px)'
    tempCtx.drawImage(tempCanvas, 0, 0)
    const blurredData = tempCtx.getImageData(0, 0, displayWidth.value, displayHeight.value)
    const src = imageData.data
    const blur = blurredData.data
    for (let i = 0; i < src.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const val = src[i + c] + (src[i + c] - blur[i + c]) * intensity
        src[i + c] = Math.min(255, Math.max(0, val))
      }
    }
    ctx.putImageData(imageData, 0, 0)
  }

  function applyHighlightsShadows(highlights, shadows) {
    if (!ctx || (highlights === 0 && shadows === 0)) return
    const imageData = ctx.getImageData(0, 0, displayWidth.value, displayHeight.value)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
      const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      if (luminance > 128) {
        const factor = highlights / 100
        data[i] = Math.min(255, Math.max(0, data[i] + data[i] * factor))
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + data[i + 1] * factor))
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + data[i + 2] * factor))
      } else {
        const factor = shadows / 100
        data[i] = Math.min(255, Math.max(0, data[i] + data[i] * factor))
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + data[i + 1] * factor))
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + data[i + 2] * factor))
      }
    }
    ctx.putImageData(imageData, 0, 0)
  }

  function applyAllAdjustments() {
    if (!ctx) return
    bakeFilter()
    // Apply pixel-level adjustments in optimal order
    applyVibrance(filterValues.vibrance)
    applyTemperature(filterValues.temperature)
    applyClarity(filterValues.clarity)
    applyHighlightsShadows(filterValues.highlights, filterValues.shadows)
    pushHistory()
    isDirty.value = true
  }

  // =========================================================================
  // 11. TEXT TOOL
  // =========================================================================

  function activateText() {
    if (overlayCanvas) {
      overlayCanvas.style.cursor = 'crosshair'
    }
    bindCanvasEvents({
      mousedown: textClickHandler,
      touchstart: function(e) { e.preventDefault(); textClickHandler(e) }
    })
  }

  function textClickHandler(e) {
    if (currentTool.value !== 'text') return
    e.preventDefault()
    const coords = getCanvasCoords(e)
    addTextAtPosition(coords.x, coords.y)
  }

  function addTextAtPosition(x, y) {
    if (!textState.content.trim()) return
    if (!ctx) return

    ctx.save()
    ctx.font = textState.fontSize + 'px sans-serif'
    ctx.fillStyle = textState.color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Configurable shadow
    if (textShadow.enabled) {
      ctx.shadowColor = textShadow.color
      ctx.shadowBlur = textShadow.blur
      ctx.shadowOffsetX = textShadow.offsetX
      ctx.shadowOffsetY = textShadow.offsetY
    }

    ctx.fillText(textState.content, x, y)
    ctx.restore()

    pushHistory()
    isDirty.value = true
  }

  // =========================================================================
  // 11. WATERMARK BRUSH & INPAINT
  // =========================================================================

  function activateWatermark() {
    if (overlayCanvas) {
      overlayCanvas.style.cursor = 'crosshair'
    }
    brush.isDrawing = false

    bindCanvasEvents({
      mousedown: brushMouseDown,
      mousemove: brushMouseMove,
      mouseup: brushMouseUp,
      touchstart: function(e) { e.preventDefault(); brushMouseDown(e) },
      touchmove: function(e) { e.preventDefault(); brushMouseMove(e) },
      touchend: brushMouseUp
    })
  }

  function brushMouseDown(e) {
    e.preventDefault()
    brush.isDrawing = true
    const coords = getCanvasCoords(e)
    brush.lastX = coords.x
    brush.lastY = coords.y
    drawBrushAt(coords.x, coords.y)
  }

  function brushMouseMove(e) {
    if (!brush.isDrawing) return
    e.preventDefault()
    const coords = getCanvasCoords(e)
    drawBrushLine(brush.lastX, brush.lastY, coords.x, coords.y)
    brush.lastX = coords.x
    brush.lastY = coords.y
  }

  function brushMouseUp() {
    brush.isDrawing = false
  }

  function drawBrushLine(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0)
    const steps = Math.ceil(dist / (brush.size * 0.5))
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps
      const x = x0 + (x1 - x0) * t
      const y = y0 + (y1 - y0) * t
      drawBrushAt(x, y)
    }
  }

  function drawBrushAt(x, y) {
    // Visual feedback on overlay canvas
    if (overlayCtx) {
      overlayCtx.save()
      overlayCtx.globalAlpha = 0.4
      overlayCtx.fillStyle = '#ff0000'
      overlayCtx.beginPath()
      overlayCtx.arc(x, y, brush.size / 2, 0, Math.PI * 2)
      overlayCtx.fill()
      overlayCtx.restore()
    }

    // Draw on mask canvas at original resolution
    if (maskCtx) {
      const maskX = x * scaleX.value
      const maskY = y * scaleY.value
      const maskSize = brush.size * scaleX.value
      maskCtx.save()
      maskCtx.fillStyle = '#ffffff'
      maskCtx.lineCap = 'round'
      maskCtx.beginPath()
      maskCtx.arc(maskX, maskY, maskSize / 2, 0, Math.PI * 2)
      maskCtx.fill()
      maskCtx.restore()
    }
  }

  function clearMask() {
    if (maskCtx) {
      maskCtx.fillStyle = '#000000'
      maskCtx.fillRect(0, 0, origWidth.value, origHeight.value)
    }
    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, displayWidth.value, displayHeight.value)
    }
  }

  async function removeWatermark() {
    if (!maskCanvas) return

    maskCanvas.toBlob(async (maskBlob) => {
      if (!maskBlob) {
        showToast('无法生成蒙版', 'error')
        return
      }

      isLoading.value = true

      try {
        const data = await apiInpaint(originalFilename.value, maskBlob, brush.size)

        if (data.success && data.url) {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            ctx.clearRect(0, 0, displayWidth.value, displayHeight.value)
            ctx.drawImage(img, 0, 0, displayWidth.value, displayHeight.value)
            pushHistory()
            isDirty.value = true
            clearMask()
            showToast('水印去除完成', 'success')
          }
          img.src = data.url
        } else {
          showToast('去除水印失败: ' + (data.error || '未知错误'), 'error')
        }
      } catch (err) {
        showToast('请求失败: ' + err.message, 'error')
      } finally {
        isLoading.value = false
      }
    }, 'image/png')
  }

  // =========================================================================
  // 12. SAVE FUNCTIONS
  // =========================================================================

  async function saveAsCopy() {
    if (!canvas) return
    canvas.toBlob(async (blob) => {
      if (!blob) {
        showToast('无法生成图像', 'error')
        return
      }
      try {
        const data = await apiSaveEdited(originalFilename.value, blob, 'copy')
        if (data.success) {
          if (fetchImages) fetchImages()
          showToast('副本保存成功', 'success')
          isDirty.value = false
        } else {
          showToast('保存失败: ' + (data.error || '未知错误'), 'error')
        }
      } catch (err) {
        showToast('请求失败: ' + err.message, 'error')
      }
    }, 'image/png')
  }

  async function overwriteOriginal() {
    if (!canvas) return
    if (!confirm('确定覆盖原图？此操作不可撤销。')) return

    canvas.toBlob(async (blob) => {
      if (!blob) {
        showToast('无法生成图像', 'error')
        return
      }
      try {
        const data = await apiSaveEdited(originalFilename.value, blob, 'overwrite')
        if (data.success) {
          if (fetchImages) fetchImages()
          showToast('原图已更新', 'success')
          isDirty.value = false
        } else {
          showToast('保存失败: ' + (data.error || '未知错误'), 'error')
        }
      } catch (err) {
        showToast('请求失败: ' + err.message, 'error')
      }
    }, 'image/png')
  }

  // =========================================================================
  // 13. TOOL MANAGEMENT
  // =========================================================================

  function deactivateCurrentTool() {
    if (crop.active) {
      cancelCrop()
    }
    if (brush.isDrawing) {
      brush.isDrawing = false
    }
    crop.active = false
    crop.dragging = false
    brush.isDrawing = false
    mosaicDrawing.value = false
    currentTool.value = null

    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, displayWidth.value, displayHeight.value)
    }
    if (overlayCanvas) {
      overlayCanvas.style.display = 'none'
    }

    if (ctx) {
      ctx.filter = 'none'
    }
    activeFilter.value = null

    unbindCanvasEvents()
    _adjustCallbacks = null
    _settingsCleanup = null
  }

  function setTool(toolName) {
    deactivateCurrentTool()
    currentTool.value = toolName

    // Show overlay canvas only for tools that need it
    if (overlayCanvas) {
      if (toolName === 'crop' || toolName === 'watermark' || toolName === 'mosaic') {
        overlayCanvas.style.display = 'block'
      } else {
        overlayCanvas.style.display = 'none'
      }
    }

    // Activate specific tool
    switch (toolName) {
      case 'crop':
        activateCrop()
        break
      case 'rotate':
        // Handled by settings events
        break
      case 'flip':
        // Handled by settings events
        break
      case 'adjust':
        activateAdjust()
        break
      case 'filter':
        // Handled by settings events
        break
      case 'text':
        activateText()
        break
      case 'watermark':
        activateWatermark()
        break
      case 'mosaic':
        activateMosaic()
        break
      default:
        break
    }
  }

  // =========================================================================
  // 14. SETTINGS PANEL RENDERERS (return HTML strings for dynamic panels)
  // =========================================================================

  function buildSettingsPanel(toolName) {
    switch (toolName) {
      case 'crop':
        return '<div class="settings-group">'
          + '<div class="ratio-buttons">'
          + '<button class="ratio-btn active" data-ratio="free">自由</button>'
          + '<button class="ratio-btn" data-ratio="1:1">1:1</button>'
          + '<button class="ratio-btn" data-ratio="4:3">4:3</button>'
          + '<button class="ratio-btn" data-ratio="16:9">16:9</button>'
          + '</div>'
          + '<div class="crop-actions">'
          + '<button id="applyCropBtn">应用裁剪</button>'
          + '<button id="cancelCropBtn">取消</button>'
          + '</div>'
          + '</div>'

      case 'rotate':
        return '<div class="settings-group">'
          + '<div class="rotate-buttons">'
          + '<button id="rotateCCWBtn">↺ 逆时针90°</button>'
          + '<button id="rotateCWBtn">↻ 顺时针90°</button>'
          + '</div>'
          + '<div class="slider-group">'
          + '<label>角度: <span id="angleValue">' + freeAngle.value + '°</span></label>'
          + '<input type="range" id="angleSlider" min="-180" max="180" value="' + freeAngle.value + '" step="1">'
          + '</div>'
          + '</div>'

      case 'flip':
        return '<div class="settings-group">'
          + '<div class="flip-buttons">'
          + '<button id="flipHBtn">水平翻转</button>'
          + '<button id="flipVBtn">垂直翻转</button>'
          + '</div>'
          + '</div>'

      case 'adjust':
        return '<div class="settings-group">'
          + '<div class="slider-group">'
          + '<label>亮度: <span id="brightValue">' + filterValues.brightness + '</span></label>'
          + '<input type="range" id="brightSlider" min="0" max="200" value="' + filterValues.brightness + '" step="1">'
          + '</div>'
          + '<div class="slider-group">'
          + '<label>对比度: <span id="contrastValue">' + filterValues.contrast + '</span></label>'
          + '<input type="range" id="contrastSlider" min="0" max="200" value="' + filterValues.contrast + '" step="1">'
          + '</div>'
          + '<div class="slider-group">'
          + '<label>饱和度: <span id="saturateValue">' + filterValues.saturation + '</span></label>'
          + '<input type="range" id="saturateSlider" min="0" max="200" value="' + filterValues.saturation + '" step="1">'
          + '</div>'
          + '<div class="slider-group">'
          + '<label>鲜明度: <span id="vibranceValue">' + filterValues.vibrance + '</span></label>'
          + '<input type="range" id="vibranceSlider" min="-100" max="100" value="' + filterValues.vibrance + '" step="1">'
          + '</div>'
          + '<div class="slider-group">'
          + '<label>色温: <span id="tempValue">' + filterValues.temperature + '</span></label>'
          + '<input type="range" id="tempSlider" min="-100" max="100" value="' + filterValues.temperature + '" step="1">'
          + '</div>'
          + '<div class="slider-group">'
          + '<label>清晰度: <span id="clarityValue">' + filterValues.clarity + '</span></label>'
          + '<input type="range" id="claritySlider" min="-100" max="100" value="' + filterValues.clarity + '" step="1">'
          + '</div>'
          + '<div class="slider-group">'
          + '<label>高光: <span id="hlValue">' + filterValues.highlights + '</span></label>'
          + '<input type="range" id="hlSlider" min="-100" max="100" value="' + filterValues.highlights + '" step="1">'
          + '</div>'
          + '<div class="slider-group">'
          + '<label>阴影: <span id="sdValue">' + filterValues.shadows + '</span></label>'
          + '<input type="range" id="sdSlider" min="-100" max="100" value="' + filterValues.shadows + '" step="1">'
          + '</div>'
          + '<button id="resetAdjustBtn">重置</button>'
          + '</div>'

      case 'filter':
        return '<div class="settings-group">'
          + '<div class="filter-buttons">'
          + '<button class="filter-btn" data-filter="grayscale">灰度</button>'
          + '<button class="filter-btn" data-filter="sepia">深褐</button>'
          + '<button class="filter-btn" data-filter="invert">反相</button>'
          + '<button class="filter-btn" data-filter="blur">模糊</button>'
          + '<button class="filter-btn" data-filter="sharpen">锐化</button>'
          + '</div>'
          + '</div>'

      case 'text':
        return '<div class="settings-group">'
          + '<div class="text-inputs">'
          + '<input type="text" id="textContent" placeholder="输入文字..." value="' + escapeHtml(textState.content) + '">'
          + '<input type="number" id="textFontSize" min="8" max="500" value="' + textState.fontSize + '">'
          + '<input type="color" id="textColor" value="' + textState.color + '">'
          + '<button id="addTextBtn">添加文字</button>'
          + '</div>'
          + '<div class="shadow-group">'
          + '<label class="form-checkbox"><input type="checkbox" id="shadowEnabled"' + (textShadow.enabled ? ' checked' : '') + '> 阴影效果</label>'
          + '<div class="slider-group"><label>阴影模糊: <span id="shadowBlurVal">' + textShadow.blur + '</span></label>'
          + '<input type="range" id="shadowBlur" min="0" max="20" value="' + textShadow.blur + '" step="1"></div>'
          + '<div class="slider-group"><label>偏移X: <span id="shadowOffXVal">' + textShadow.offsetX + '</span></label>'
          + '<input type="range" id="shadowOffX" min="-20" max="20" value="' + textShadow.offsetX + '" step="1"></div>'
          + '<div class="slider-group"><label>偏移Y: <span id="shadowOffYVal">' + textShadow.offsetY + '</span></label>'
          + '<input type="range" id="shadowOffY" min="-20" max="20" value="' + textShadow.offsetY + '" step="1"></div>'
          + '<label>阴影颜色: <input type="color" id="shadowColor" value="' + textShadow.color + '"></label>'
          + '</div>'
          + '<p class="hint">点击画布添加文字</p>'
          + '</div>'

      case 'mosaic':
        return '<div class="settings-group">'
          + '<div class="slider-group">'
          + '<label>画笔大小: <span id="mosaicBrushVal">' + brush.size + '</span></label>'
          + '<input type="range" id="mosaicBrushSlider" min="10" max="150" value="' + brush.size + '" step="1">'
          + '</div>'
          + '<div class="slider-group">'
          + '<label>马赛克块: <span id="mosaicBlockVal">' + mosaicBlockSize.value + 'px</span></label>'
          + '<input type="range" id="mosaicBlockSlider" min="5" max="60" value="' + mosaicBlockSize.value + '" step="1">'
          + '</div>'
          + '<p class="hint">在画布上涂抹需要打马赛克的区域</p>'
          + '</div>'

      case 'watermark':
        return '<div class="settings-group">'
          + '<div class="slider-group">'
          + '<label>画笔大小: <span id="brushSizeValue">' + brush.size + '</span></label>'
          + '<input type="range" id="brushSizeSlider" min="5" max="100" value="' + brush.size + '" step="1">'
          + '</div>'
          + '<button id="clearMaskBtn">清除蒙版</button>'
          + '<button id="removeWatermarkBtn">去除水印</button>'
          + '</div>'

      default:
        return ''
    }
  }

  // =========================================================================
  // 15. SETTINGS EVENT BINDING (called by component after DOM update)
  // =========================================================================

  function bindSettingsEvents(toolName, settingsEl) {
    if (!settingsEl) return

    // Store cleanup reference
    _settingsCleanup = { el: settingsEl, listeners: [] }

    function on(selector, event, handler) {
      const el = typeof selector === 'string' ? settingsEl.querySelector(selector) : selector
      if (el) {
        el.addEventListener(event, handler)
        _settingsCleanup.listeners.push({ el, event, handler })
      }
    }

    switch (toolName) {
      case 'crop':
        // Ratio buttons via delegation
        settingsEl.addEventListener('click', function cropSettingsClick(e) {
          const ratioBtn = e.target.closest('.ratio-btn')
          if (ratioBtn) {
            const btns = settingsEl.querySelectorAll('.ratio-btn')
            btns.forEach(b => b.classList.remove('active'))
            ratioBtn.classList.add('active')
            const ratio = ratioBtn.getAttribute('data-ratio')
            if (ratio === 'free') {
              crop.aspectRatio = null
            } else {
              const parts = ratio.split(':')
              crop.aspectRatio = parseFloat(parts[0]) / parseFloat(parts[1])
            }
          }
          if (e.target.id === 'applyCropBtn') {
            applyCrop()
          }
          if (e.target.id === 'cancelCropBtn') {
            cancelCrop()
          }
        })
        _settingsCleanup.listeners.push({ el: settingsEl, event: 'click', handler: null, delegated: true })
        break

      case 'rotate': {
        const angleSlider = settingsEl.querySelector('#angleSlider')
        const angleValue = settingsEl.querySelector('#angleValue')

        const ccwBtn = settingsEl.querySelector('#rotateCCWBtn')
        const cwBtn = settingsEl.querySelector('#rotateCWBtn')
        if (ccwBtn) on(ccwBtn, 'click', () => rotate90('ccw'))
        if (cwBtn) on(cwBtn, 'click', () => rotate90('cw'))

        if (angleSlider && angleValue) {
          const onInput = () => {
            freeAngle.value = parseInt(angleSlider.value)
            angleValue.textContent = freeAngle.value + '°'
          }
          const onChange = () => {
            freeAngle.value = parseInt(angleSlider.value)
            rotateFree(freeAngle.value)
          }
          on(angleSlider, 'input', onInput)
          on(angleSlider, 'change', onChange)
        }
        break
      }

      case 'flip': {
        const flipHBtn = settingsEl.querySelector('#flipHBtn')
        const flipVBtn = settingsEl.querySelector('#flipVBtn')
        if (flipHBtn) on(flipHBtn, 'click', flipHorizontal)
        if (flipVBtn) on(flipVBtn, 'click', flipVertical)
        break
      }

      case 'adjust': {
        const brightSlider = settingsEl.querySelector('#brightSlider')
        const contrastSlider = settingsEl.querySelector('#contrastSlider')
        const saturateSlider = settingsEl.querySelector('#saturateSlider')
        const vibranceSlider = settingsEl.querySelector('#vibranceSlider')
        const tempSlider = settingsEl.querySelector('#tempSlider')
        const claritySlider = settingsEl.querySelector('#claritySlider')
        const hlSlider = settingsEl.querySelector('#hlSlider')
        const sdSlider = settingsEl.querySelector('#sdSlider')
        const brightValue = settingsEl.querySelector('#brightValue')
        const contrastValue = settingsEl.querySelector('#contrastValue')
        const saturateValue = settingsEl.querySelector('#saturateValue')
        const vibranceValue = settingsEl.querySelector('#vibranceValue')
        const tempValue = settingsEl.querySelector('#tempValue')
        const clarityValue = settingsEl.querySelector('#clarityValue')
        const hlValue = settingsEl.querySelector('#hlValue')
        const sdValue = settingsEl.querySelector('#sdValue')
        const resetBtn = settingsEl.querySelector('#resetAdjustBtn')

        function updatePreview() {
          filterValues.brightness = parseInt(brightSlider.value)
          filterValues.contrast = parseInt(contrastSlider.value)
          filterValues.saturation = parseInt(saturateSlider.value)
          filterValues.vibrance = parseInt(vibranceSlider.value)
          filterValues.temperature = parseInt(tempSlider.value)
          filterValues.clarity = parseInt(claritySlider.value)
          filterValues.highlights = parseInt(hlSlider.value)
          filterValues.shadows = parseInt(sdSlider.value)
          if (brightValue) brightValue.textContent = filterValues.brightness
          if (contrastValue) contrastValue.textContent = filterValues.contrast
          if (saturateValue) saturateValue.textContent = filterValues.saturation
          if (vibranceValue) vibranceValue.textContent = filterValues.vibrance
          if (tempValue) tempValue.textContent = filterValues.temperature
          if (clarityValue) clarityValue.textContent = filterValues.clarity
          if (hlValue) hlValue.textContent = filterValues.highlights
          if (sdValue) sdValue.textContent = filterValues.shadows
          // CSS filter preview for brightness/contrast/saturation only
          if (_adjustCallbacks && _adjustCallbacks.onSliderInput) {
            _adjustCallbacks.onSliderInput()
          }
        }

        function onSliderChange() {
          if (_adjustCallbacks && _adjustCallbacks.onSliderChange) {
            _adjustCallbacks.onSliderChange()
          }
          // Apply pixel-level adjustments after CSS filter is baked
          applyAllAdjustments()
        }

        if (brightSlider) { on(brightSlider, 'input', updatePreview); on(brightSlider, 'change', onSliderChange) }
        if (contrastSlider) { on(contrastSlider, 'input', updatePreview); on(contrastSlider, 'change', onSliderChange) }
        if (saturateSlider) { on(saturateSlider, 'input', updatePreview); on(saturateSlider, 'change', onSliderChange) }
        if (vibranceSlider) { on(vibranceSlider, 'input', updatePreview); on(vibranceSlider, 'change', onSliderChange) }
        if (tempSlider) { on(tempSlider, 'input', updatePreview); on(tempSlider, 'change', onSliderChange) }
        if (claritySlider) { on(claritySlider, 'input', updatePreview); on(claritySlider, 'change', onSliderChange) }
        if (hlSlider) { on(hlSlider, 'input', updatePreview); on(hlSlider, 'change', onSliderChange) }
        if (sdSlider) { on(sdSlider, 'input', updatePreview); on(sdSlider, 'change', onSliderChange) }
        if (resetBtn) { on(resetBtn, 'click', resetAdjust) }
        break
      }

      case 'filter':
        settingsEl.addEventListener('click', function filterSettingsClick(e) {
          const filterBtn = e.target.closest('.filter-btn')
          if (filterBtn) {
            applyFilter(filterBtn.getAttribute('data-filter'))
          }
        })
        _settingsCleanup.listeners.push({ el: settingsEl, event: 'click', handler: null, delegated: true })
        break

      case 'text': {
        const textContent = settingsEl.querySelector('#textContent')
        const textFontSize = settingsEl.querySelector('#textFontSize')
        const textColor = settingsEl.querySelector('#textColor')
        const addTextBtn = settingsEl.querySelector('#addTextBtn')
        const shadowEnabled = settingsEl.querySelector('#shadowEnabled')
        const shadowBlur = settingsEl.querySelector('#shadowBlur')
        const shadowOffX = settingsEl.querySelector('#shadowOffX')
        const shadowOffY = settingsEl.querySelector('#shadowOffY')
        const shadowColor = settingsEl.querySelector('#shadowColor')
        const shadowBlurVal = settingsEl.querySelector('#shadowBlurVal')
        const shadowOffXVal = settingsEl.querySelector('#shadowOffXVal')
        const shadowOffYVal = settingsEl.querySelector('#shadowOffYVal')

        if (textContent) on(textContent, 'input', () => { textState.content = textContent.value })
        if (textFontSize) on(textFontSize, 'input', () => { textState.fontSize = parseInt(textFontSize.value) || 48 })
        if (textColor) on(textColor, 'input', () => { textState.color = textColor.value })
        if (shadowEnabled) on(shadowEnabled, 'change', () => { textShadow.enabled = shadowEnabled.checked })
        if (shadowBlur) on(shadowBlur, 'input', () => { textShadow.blur = parseInt(shadowBlur.value); if (shadowBlurVal) shadowBlurVal.textContent = textShadow.blur })
        if (shadowOffX) on(shadowOffX, 'input', () => { textShadow.offsetX = parseInt(shadowOffX.value); if (shadowOffXVal) shadowOffXVal.textContent = textShadow.offsetX })
        if (shadowOffY) on(shadowOffY, 'input', () => { textShadow.offsetY = parseInt(shadowOffY.value); if (shadowOffYVal) shadowOffYVal.textContent = textShadow.offsetY })
        if (shadowColor) on(shadowColor, 'input', () => { textShadow.color = shadowColor.value })
        if (addTextBtn) {
          on(addTextBtn, 'click', () => {
            addTextAtPosition(displayWidth.value / 2, displayHeight.value / 2)
          })
        }
        break
      }

      case 'mosaic': {
        const brushSlider = settingsEl.querySelector('#mosaicBrushSlider')
        const brushVal = settingsEl.querySelector('#mosaicBrushVal')
        const blockSlider = settingsEl.querySelector('#mosaicBlockSlider')
        const blockVal = settingsEl.querySelector('#mosaicBlockVal')

        if (brushSlider && brushVal) {
          on(brushSlider, 'input', () => {
            brush.size = parseInt(brushSlider.value)
            brushVal.textContent = brush.size
          })
        }
        if (blockSlider && blockVal) {
          on(blockSlider, 'input', () => {
            mosaicBlockSize.value = parseInt(blockSlider.value)
            blockVal.textContent = mosaicBlockSize.value + 'px'
          })
        }
        break
      }

      case 'watermark': {
        const brushSizeSlider = settingsEl.querySelector('#brushSizeSlider')
        const brushSizeValue = settingsEl.querySelector('#brushSizeValue')

        if (brushSizeSlider && brushSizeValue) {
          on(brushSizeSlider, 'input', () => {
            brush.size = parseInt(brushSizeSlider.value)
            brushSizeValue.textContent = brush.size
          })
        }

        const clearMaskBtn = settingsEl.querySelector('#clearMaskBtn')
        const removeWatermarkBtn = settingsEl.querySelector('#removeWatermarkBtn')
        if (clearMaskBtn) on(clearMaskBtn, 'click', clearMask)
        if (removeWatermarkBtn) on(removeWatermarkBtn, 'click', removeWatermark)
        break
      }

      default:
        break
    }
  }

  // =========================================================================
  // 16. LIFECYCLE: OPEN / CLOSE EDITOR
  // =========================================================================

  function initCanvas() {
    const img = originalImage.value
    if (!img) return
    const maxDim = 2000
    let w = img.naturalWidth
    let h = img.naturalHeight

    if (w >= h) {
      if (w > maxDim) {
        displayWidth.value = maxDim
        displayHeight.value = Math.round((h / w) * maxDim)
      } else {
        displayWidth.value = w
        displayHeight.value = h
      }
    } else {
      if (h > maxDim) {
        displayHeight.value = maxDim
        displayWidth.value = Math.round((w / h) * maxDim)
      } else {
        displayWidth.value = w
        displayHeight.value = h
      }
    }

    scaleX.value = origWidth.value / displayWidth.value
    scaleY.value = origHeight.value / displayHeight.value

    const c = canvasEl.value
    const oc = overlayCanvasEl.value

    if (!c || !oc) return

    c.width = displayWidth.value
    c.height = displayHeight.value
    canvas = c
    ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0, displayWidth.value, displayHeight.value)

    oc.width = displayWidth.value
    oc.height = displayHeight.value
    overlayCanvas = oc
    overlayCtx = oc.getContext('2d')

    // Mask canvas at original resolution (all black)
    maskCanvas = document.createElement('canvas')
    maskCanvas.width = origWidth.value
    maskCanvas.height = origHeight.value
    maskCtx = maskCanvas.getContext('2d')
    maskCtx.fillStyle = '#000000'
    maskCtx.fillRect(0, 0, origWidth.value, origHeight.value)

    // Push initial state to history
    history.value = []
    historyIndex.value = -1
    pushHistory()
  }

  function openEditor(idx) {
    imageIndex.value = idx
    originalFilename.value = images.value[idx].filename
    isDirty.value = false
    history.value = []
    historyIndex.value = -1
    currentTool.value = null
    crop.active = false
    crop.dragging = false
    brush.isDrawing = false
    freeAngle.value = 0
    filterValues.brightness = 100
    filterValues.contrast = 100
    filterValues.saturation = 100
    activeFilter.value = null
    isLoading.value = false

    isOpen.value = true
    document.body.style.overflow = 'hidden'

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = function() {
      originalImage.value = img
      origWidth.value = img.naturalWidth
      origHeight.value = img.naturalHeight
      // Wait for nextTick so canvas template refs are available
      nextTick(() => {
        initCanvas()
      })
    }
    img.src = images.value[idx].url

    // If image is already loaded (cached), trigger onload
    if (img.complete) {
      img.onload()
    }
  }

  function closeEditor() {
    if (isDirty.value) {
      if (!confirm('有未保存的修改，确定关闭吗？')) return
    }
    deactivateCurrentTool()
    _settingsCleanup = null
    isOpen.value = false
    document.body.style.overflow = ''
    canvas = null
    ctx = null
    overlayCanvas = null
    overlayCtx = null
    maskCanvas = null
    maskCtx = null
    originalImage.value = null
    crop.active = false
    crop.dragging = false
    brush.isDrawing = false
  }

  // =========================================================================
  // 17. KEYBOARD HANDLER
  // =========================================================================

  function handleKeydown(e) {
    if (!isOpen.value) return

    // Ctrl+Z: Undo
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      undo()
      return
    }

    // Ctrl+Y or Ctrl+Shift+Z: Redo
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
      e.preventDefault()
      redo()
      return
    }

    // Ctrl+S: Save as copy
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault()
      saveAsCopy()
      return
    }

    // Escape
    if (e.key === 'Escape') {
      e.preventDefault()
      if (crop.active || crop.dragging) {
        cancelCrop()
      } else if (currentTool.value === 'watermark') {
        clearMask()
      } else {
        closeEditor()
      }
      return
    }
  }

  // =========================================================================
  // 18. EXPORT
  // =========================================================================

  return {
    // Canvas refs (bind in template)
    canvasEl,
    overlayCanvasEl,

    // Reactive state
    isOpen,
    imageIndex,
    originalFilename,
    originalImage,
    displayWidth,
    displayHeight,
    origWidth,
    origHeight,
    scaleX,
    scaleY,
    currentTool,
    isDirty,
    isLoading,
    freeAngle,
    crop,
    brush,
    filterValues,
    activeFilter,
    textState,
    history,
    historyIndex,
    undoDisabled,
    redoDisabled,

    // Lifecycle
    openEditor,
    closeEditor,
    initCanvas,

    // Tools
    setTool,
    deactivateCurrentTool,
    buildSettingsPanel,
    bindSettingsEvents,
    getCanvasCoords,

    // History
    undo,
    redo,
    pushHistory,

    // Canvas utils
    redrawCanvas,
    bakeFilter,

    // Flip & Rotate
    flipHorizontal,
    flipVertical,
    rotate90,
    rotateFree,

    // Crop
    activateCrop,
    cropMouseDown,
    cropMouseMove,
    cropMouseUp,
    drawCropOverlay,
    applyCrop,
    cancelCrop,
    cancelCropInternal,

    // Adjust
    activateAdjust,
    resetAdjust,

    // Filter
    applyFilter,
    applySharpen,

    // Text
    activateText,
    textClickHandler,
    addTextAtPosition,

    // Watermark
    activateWatermark,
    brushMouseDown,
    brushMouseMove,
    brushMouseUp,
    drawBrushLine,
    drawBrushAt,
    clearMask,
    removeWatermark,

    // Save
    saveAsCopy,
    overwriteOriginal,

    // Keyboard
    handleKeydown,
    bindCanvasEvents,
    unbindCanvasEvents,

    // Internal (for cleanup)
    _boundHandlers: () => _boundHandlers,
    _settingsCleanup: () => _settingsCleanup
  }
}
