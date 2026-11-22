/** Browser fullscreen can reject when the document is no longer active; that is cleanup, not an error. */
function exitFullscreenQuietly() {
  if (typeof document === 'undefined' || typeof document.exitFullscreen !== 'function') return
  try {
    var result = document.exitFullscreen()
    if (result && typeof result.catch === 'function') result.catch(function () {})
  } catch (error) {
    // The document changed while the request was in flight.
  }
}
