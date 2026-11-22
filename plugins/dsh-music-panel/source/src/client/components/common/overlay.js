/**
 * overlay: the single layer stack plus toast.
 *
 * Every popover, dialog and sheet pushes onto this stack; Escape pops the top
 * one. Nothing else in the UI is allowed to invent a z-index.
 */

var overlayStore = createStore({ layers: [] })
var toastStore = createStore({ text: '', seq: 0 })
var toastTimer = null

function pushLayer(kind, props) {
  var layers = overlayStore.get().layers.filter(function (layer) {
    return layer.kind !== kind
  })
  layers.push({ kind: kind, props: props || {} })
  overlayStore.set({ layers: layers })
}

function popLayer() {
  var layers = overlayStore.get().layers
  if (layers.length === 0) return false
  overlayStore.set({ layers: layers.slice(0, layers.length - 1) })
  return true
}

function removeLayer(kind) {
  var layers = overlayStore.get().layers
  var next = layers.filter(function (layer) {
    return layer.kind !== kind
  })
  if (next.length !== layers.length) overlayStore.set({ layers: next })
}

function topLayer() {
  var layers = overlayStore.get().layers
  return layers.length > 0 ? layers[layers.length - 1] : null
}

function hasLayer(kind) {
  return overlayStore.get().layers.some(function (layer) {
    return layer.kind === kind
  })
}

function showToast(text) {
  var message = String(text || '')
  if (message === '') return
  var seq = toastStore.get().seq + 1
  toastStore.set({ text: message, seq: seq })
  if (toastTimer !== null) clearTimeout(toastTimer)
  toastTimer = setTimeout(function () {
    toastTimer = null
    if (toastStore.get().seq === seq) toastStore.set({ text: '', seq: seq })
  }, 1800)
}
