/** Lucide icon mapping (ISC), so the plugin does not hand-draw its glyphs. */
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, Copy, Download,
  Ellipsis, ExternalLink, Folder, Image, ImageOff, LayoutGrid, Link2, List,
  Maximize, Music2, Pause, PictureInPicture2, Play, Plus, RefreshCw, Scan,
  Volume2, VolumeX,
  Search, SlidersHorizontal, Trash2, Video, X, ZoomIn, ZoomOut,
} from 'lucide-react'
import React from 'react'

const ICONS = {
  alert: AlertTriangle,
  audio: Music2,
  check: Check,
  chevron: ChevronDown,
  close: X,
  copy: Copy,
  download: Download,
  external: ExternalLink,
  fileError: ImageOff,
  filter: SlidersHorizontal,
  fit: Scan,
  folder: Folder,
  full: Maximize,
  grid: LayoutGrid,
  image: Image,
  left: ArrowLeft,
  link: Link2,
  list: List,
  more: Ellipsis,
  mute: VolumeX,
  pause: Pause,
  pip: PictureInPicture2,
  play: Play,
  plus: Plus,
  refresh: RefreshCw,
  right: ArrowRight,
  search: Search,
  trash: Trash2,
  video: Video,
  volume: Volume2,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
}

export function Icon({ name, size = 16, ...rest }) {
  const Component = ICONS[name] ?? Ellipsis
  return React.createElement(Component, {
    size, strokeWidth: 1.7, 'aria-hidden': true, ...rest,
  })
}

export function IconButton({ name, label, onClick, active, disabled, className = '' }) {
  return React.createElement('button', {
    type: 'button',
    className: `vms-icon-btn ${className}`.trim(),
    title: label,
    'aria-label': label,
    'aria-pressed': active === undefined ? undefined : active,
    disabled,
    onClick,
  }, React.createElement(Icon, { name }))
}
