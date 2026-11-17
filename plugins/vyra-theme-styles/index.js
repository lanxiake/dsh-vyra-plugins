// Host half: nothing to do.
//
// The whole feature is a browser-side token override — the palettes are CSS
// variables applied to `document.body`, so no Host service, route or storage is
// involved. This file exists only because a bundle row needs a Host entry point.
export const name = 'dsh-theme-styles'
export const inject = []
export function apply() {}
