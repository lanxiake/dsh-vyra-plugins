/**
 * The tiny slice of `lucide-react` the ported Pendolo renderer needs.
 *
 * The plugin does not ship lucide-react (its own icons live in src/15-icons.js and
 * src/19-extra-icons.js). Pendolo only draws the theme's lyric icon on the balance
 * wheel and falls back to `Star` when the theme carries none, so one faithful star
 * path is enough; anything else resolves to the same placeholder.
 */

import React from 'react'

const starPath = 'M12 2.6l2.95 5.98 6.6.96-4.78 4.66 1.13 6.58L12 17.68l-5.9 3.1 1.13-6.58L2.45 9.54l6.6-.96L12 2.6z'

function makeIcon(path) {
  return function Icon(props) {
    const size = Number(props && props.size) || 24
    return React.createElement(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'currentColor',
        stroke: 'currentColor',
        strokeWidth: 1,
        'aria-hidden': 'true',
        style: props && props.style,
        className: props && props.className,
      },
      React.createElement('path', { d: path }),
    )
  }
}

export const Star = makeIcon(starPath)
export const Disc3 = makeIcon('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5a4 4 0 1 1 0 8 4 4 0 0 1 0-8z')
export const Aperture = makeIcon(starPath)
export const Cone = makeIcon(starPath)
export const Layers = makeIcon(starPath)
export const Columns3 = makeIcon(starPath)
export const Wind = makeIcon(starPath)
export const Square = makeIcon('M4 4h16v16H4z')
export const ImagePlus = makeIcon(starPath)
export const Trash2 = makeIcon(starPath)
export const Pencil = makeIcon(starPath)
export const Plus = makeIcon('M12 5v14M5 12h14')
export const Upload = makeIcon(starPath)
export const Smile = makeIcon(starPath)
export const SeparatorVertical = makeIcon(starPath)
export const Hourglass = makeIcon(starPath)
export const EyeOff = makeIcon(starPath)
export const RotateCcw = makeIcon(starPath)
export const AlignLeft = makeIcon(starPath)
export const AudioWaveform = makeIcon(starPath)
export const Move = makeIcon(starPath)
export const Spline = makeIcon(starPath)
export const Frame = makeIcon(starPath)
export const Sparkles = makeIcon(starPath)
export const WandSparkles = makeIcon(starPath)
export const Scan = makeIcon(starPath)
export const Ghost = makeIcon(starPath)
export const Highlighter = makeIcon(starPath)
export const defaultIcon = Star
