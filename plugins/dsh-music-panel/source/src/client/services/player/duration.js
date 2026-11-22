/**
 * One duration for every seek surface.
 *
 * MediaSource reports only the appended prefix until more data lands, and an
 * <audio> element starts at 0 before metadata. The scanned track length is the
 * full-song ceiling; never let the smaller, still-growing media duration win.
 */
function effectivePlayerDuration(mediaDuration, trackDuration) {
  var media = Number(mediaDuration)
  var known = Number(trackDuration)
  return Math.max(isFinite(media) && media > 0 ? media : 0, isFinite(known) && known > 0 ? known : 0)
}
