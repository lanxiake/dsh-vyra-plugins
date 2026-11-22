/**
 * inline SVG icon set (Feather/Lucide paths, MIT).
 *
 * Extracted from client.js at the 0.11.1 baseline (3931c14).
 */

// ── icons (Feather/Lucide paths, MIT) ─────────────────────────────────

var ICONS = {
  check: { parts: [['path', { d: 'M20 6L9 17l-5-5' }]] },
  clock: {
    parts: [
      ['circle', { cx: 12, cy: 12, r: 9 }],
      ['path', { d: 'M12 7v5l3 2' }],
    ],
  },
  download: {
    parts: [
      ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }],
      ['path', { d: 'M7 10l5 5 5-5' }],
      ['path', { d: 'M12 15V3' }],
    ],
  },
  target: {
    parts: [
      ['circle', { cx: 12, cy: 12, r: 7 }],
      ['circle', { cx: 12, cy: 12, r: 2.5 }],
      ['path', { d: 'M12 2v3M12 19v3M2 12h3M19 12h3' }],
    ],
  },
  refresh: {
    parts: [
      ['path', { d: 'M21 12a9 9 0 1 1-2.64-6.36' }],
      ['path', { d: 'M21 3v6h-6' }],
    ],
  },
  settings: {
    parts: [
      ['circle', { cx: 12, cy: 12, r: 3 }],
      [
        'path',
        {
          d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
        },
      ],
    ],
  },
  checkCircle: {
    parts: [
      ['circle', { cx: 12, cy: 12, r: 10 }],
      ['path', { d: 'M8 12.5l2.5 2.5L16 9.5' }],
    ],
  },
  sort: {
    parts: [
      ['path', { d: 'M7 4v16' }],
      ['path', { d: 'M4 7l3-3 3 3' }],
      ['path', { d: 'M17 20V4' }],
      ['path', { d: 'M14 17l3 3 3-3' }],
    ],
  },
  search: {
    parts: [
      ['circle', { cx: 11, cy: 11, r: 7 }],
      ['path', { d: 'M21 21l-4.3-4.3' }],
    ],
  },
  repeat: {
    parts: [
      ['path', { d: 'M17 2l4 4-4 4' }],
      ['path', { d: 'M3 11V9a4 4 0 014-4h14' }],
      ['path', { d: 'M7 22l-4-4 4-4' }],
      ['path', { d: 'M21 13v2a4 4 0 01-4 4H3' }],
    ],
  },
  repeatOne: {
    parts: [
      ['path', { d: 'M17 2l4 4-4 4' }],
      ['path', { d: 'M3 11V9a4 4 0 014-4h14' }],
      ['path', { d: 'M7 22l-4-4 4-4' }],
      ['path', { d: 'M21 13v2a4 4 0 01-4 4H3' }],
      ['path', { d: 'M12 10v4' }],
      ['path', { d: 'M11 11l1-1' }],
    ],
  },
  shuffle: {
    parts: [
      ['path', { d: 'M16 3h5v5' }],
      ['path', { d: 'M4 20L21 3' }],
      ['path', { d: 'M21 16v5h-5' }],
      ['path', { d: 'M15 15l6 6' }],
      ['path', { d: 'M4 4l5 5' }],
    ],
  },
  x: {
    parts: [
      ['path', { d: 'M18 6L6 18' }],
      ['path', { d: 'M6 6l12 12' }],
    ],
  },
  prev: {
    parts: [
      ['path', { d: 'M19 20L9 12l10-8v16z' }],
      ['path', { d: 'M5 19V5' }],
    ],
  },
  next: {
    parts: [
      ['path', { d: 'M5 4l10 8-10 8V4z' }],
      ['path', { d: 'M19 5v14' }],
    ],
  },
  play: { fill: true, parts: [['path', { d: 'M7 4.5v15l13-7.5-13-7.5z' }]] },
  pause: {
    fill: true,
    parts: [
      ['rect', { x: 6, y: 4, width: 4, height: 16, rx: 1 }],
      ['rect', { x: 14, y: 4, width: 4, height: 16, rx: 1 }],
    ],
  },
  list: {
    parts: [
      ['path', { d: 'M8 6h13' }],
      ['path', { d: 'M8 12h13' }],
      ['path', { d: 'M8 18h13' }],
      ['path', { d: 'M3 6h.01' }],
      ['path', { d: 'M3 12h.01' }],
      ['path', { d: 'M3 18h.01' }],
    ],
  },
  more: {
    parts: [
      ['circle', { cx: 5, cy: 12, r: 1.4 }],
      ['circle', { cx: 12, cy: 12, r: 1.4 }],
      ['circle', { cx: 19, cy: 12, r: 1.4 }],
    ],
  },
  volume: {
    parts: [
      ['path', { d: 'M11 5L6 9H2v6h4l5 4V5z' }],
      ['path', { d: 'M15.5 8.5a5 5 0 010 7' }],
      ['path', { d: 'M18.5 5.5a9 9 0 010 13' }],
    ],
  },
  volumeLow: {
    parts: [
      ['path', { d: 'M11 5L6 9H2v6h4l5 4V5z' }],
      ['path', { d: 'M15.5 8.5a5 5 0 010 7' }],
    ],
  },
  equalizer: {
    parts: [
      ['path', { d: 'M4 10v4' }],
      ['path', { d: 'M8 7v10' }],
      ['path', { d: 'M12 4v16' }],
      ['path', { d: 'M16 8v8' }],
      ['path', { d: 'M20 11v2' }],
    ],
  },
  mute: {
    parts: [
      ['path', { d: 'M11 5L6 9H2v6h4l5 4V5z' }],
      ['path', { d: 'M22 9l-6 6' }],
      ['path', { d: 'M16 9l6 6' }],
    ],
  },
  note: {
    parts: [
      ['path', { d: 'M9 18V5l12-2v13' }],
      ['circle', { cx: 6, cy: 18, r: 3 }],
      ['circle', { cx: 18, cy: 16, r: 3 }],
    ],
  },
  star: { parts: [['path', { d: 'M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.9L12 3z' }]] },
  heart: {
    parts: [
      ['path', { d: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z' }],
    ],
  },
  heartFill: {
    fill: true,
    parts: [
      ['path', { d: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z' }],
    ],
  },
  chevronDown: {
    parts: [['path', { d: 'M6 9l6 6 6-6' }]],
  },
  chevronLeft: {
    parts: [['path', { d: 'M15 18l-6-6 6-6' }]],
  },
  trash: {
    parts: [
      ['path', { d: 'M3 6h18' }],
      ['path', { d: 'M8 6V4h8v2' }],
      ['path', { d: 'M19 6l-1 14H6L5 6' }],
    ],
  },
  plus: {
    parts: [
      ['path', { d: 'M12 5v14' }],
      ['path', { d: 'M5 12h14' }],
    ],
  },
  folder: {
    parts: [['path', { d: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z' }]],
  },
  hardDrive: {
    parts: [
      ['path', { d: 'M5 12H2v7a2 2 0 002 2h16a2 2 0 002-2v-7h-3' }],
      ['path', { d: 'M5 12V5a2 2 0 012-2h10a2 2 0 012 2v7' }],
      ['path', { d: 'M7 16h.01M11 16h6' }],
    ],
  },
  copy: {
    parts: [
      ['rect', { x: 9, y: 9, width: 13, height: 13, rx: 2, ry: 2 }],
      ['path', { d: 'M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1' }],
    ],
  },
  info: {
    parts: [
      ['circle', { cx: 12, cy: 12, r: 10 }],
      ['path', { d: 'M12 16v-4' }],
      ['path', { d: 'M12 8h.01' }],
    ],
  },
  edit: {
    parts: [
      ['path', { d: 'M12 20h9' }],
      ['path', { d: 'M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z' }],
    ],
  },
  music: {
    parts: [
      ['path', { d: 'M9 18V5l12-2v13' }],
      ['circle', { cx: 6, cy: 18, r: 3 }],
      ['circle', { cx: 18, cy: 16, r: 3 }],
    ],
  },
  user: {
    parts: [
      ['path', { d: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2' }],
      ['circle', { cx: 12, cy: 7, r: 4 }],
    ],
  },
  server: {
    parts: [
      ['rect', { x: 3, y: 4, width: 18, height: 7, rx: 2 }],
      ['rect', { x: 3, y: 13, width: 18, height: 7, rx: 2 }],
      ['path', { d: 'M7 7.5h.01M7 16.5h.01' }],
    ],
  },
  back: {
    parts: [['path', { d: 'M15 18l-6-6 6-6' }]],
  },
  close: {
    parts: [
      ['path', { d: 'M18 6L6 18' }],
      ['path', { d: 'M6 6l12 12' }],
    ],
  },
  logout: {
    parts: [
      ['path', { d: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4' }],
      ['path', { d: 'M16 17l5-5-5-5' }],
      ['path', { d: 'M21 12H9' }],
    ],
  },
  playlist: {
    parts: [
      ['path', { d: 'M3 6h13M3 12h10M3 18h7' }],
      ['path', { d: 'M17 15l4 3-4 3v-6z' }],
    ],
  },
  disc: {
    parts: [
      ['circle', { cx: 12, cy: 12, r: 9 }],
      ['circle', { cx: 12, cy: 12, r: 2.5 }],
    ],
  },
  chart: {
    parts: [
      ['path', { d: 'M4 20V10M10 20V4M16 20v-7M22 20H2' }],
    ],
  },
  right: {
    parts: [['path', { d: 'M9 18l6-6-6-6' }]],
  },
  warning: {
    parts: [
      ['path', { d: 'M12 3l9 16H3L12 3z' }],
      ['path', { d: 'M12 9v5M12 17h.01' }],
    ],
  },
  up: {
    parts: [['path', { d: 'M12 19V5M5 12l7-7 7 7' }]],
  },
  down: {
    parts: [['path', { d: 'M12 5v14M19 12l-7 7-7-7' }]],
  },
}

function merge(base, extra) {
  var out = {}
  Object.keys(base).forEach(function (key) {
    out[key] = base[key]
  })
  if (extra) {
    Object.keys(extra).forEach(function (key) {
      out[key] = extra[key]
    })
  }
  return out
}

function icon(name, size, extra) {
  var hostName = HOST_ICON_MAP && HOST_ICON_MAP[name]
  var HostIcon = hostName ? hostComponent(hostName) : null
  if (HostIcon !== null) {
    return h(HostIcon, { size: size || 18, 'aria-hidden': 'true', focusable: 'false' })
  }
  var spec = ICONS[name] || ICONS.note
  var children = spec.parts.map(function (part, index) {
    return h(part[0], merge({ key: String(index) }, part[1]))
  })
  var props = {
    width: size || 18,
    height: size || 18,
    viewBox: '0 0 24 24',
    'aria-hidden': 'true',
    focusable: 'false',
    fill: spec.fill === true ? 'currentColor' : 'none',
    stroke: spec.fill === true ? 'none' : 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  return h('svg', merge(props, extra), children)
}
