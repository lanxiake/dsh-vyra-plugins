/**
 * Layer scale — every stacking value in the plugin comes from here.
 *
 * Folia documents its steps in comments and gives windows that must beat
 * everything an explicit flag (`overAllLayers` → z-[200]); this is the same idea
 * with one table instead of scattered numbers:
 *
 *   1    content      something raised over its own background
 *   60   page         a full-page surface inside the panel
 *   70   pageRaised   the player page, and popovers that must sit on a page
 *   80   menu         context menus, anchored popovers
 *   85   dialog       panel-level dialogs and overlays
 *   86   guide        the startup guide
 *   90   toast        toasts
 *   120  overPage     windows that must sit above the player page (匹配歌词)
 *   200  overAll      a window that must sit above every plugin layer
 *
 * The plugin root isolates its own stacking context, so nothing in here competes
 * with the host's layers: a window that must beat a host modal has to be a host
 * modal, not a larger number.
 */

var MP_Z = {
  content: 1,
  page: 60,
  pageRaised: 70,
  menu: 80,
  dialog: 85,
  guide: 86,
  toast: 90,
  overPage: 120,
  overAll: 200,
}

/** The same scale for the stylesheet, as CSS variables on `.mp-root`. */
var MP_Z_CSS =
  '--mp-z-page:60;--mp-z-page-raised:70;--mp-z-menu:80;--mp-z-dialog:85;' +
  '--mp-z-guide:86;--mp-z-toast:90;--mp-z-over-page:120;--mp-z-over-all:200'
