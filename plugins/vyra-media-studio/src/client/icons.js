/** Lucide icon mapping (ISC), so the plugin does not hand-draw its glyphs. */
import {
  AlertTriangle, AppWindow, ArrowLeft, ArrowRight, AtSign, Check, ChevronDown,
  ChevronLeft, ChevronRight, ClipboardCopy, Copy, Download, Ellipsis,
  ExternalLink, File, FileArchive, FileCode, FileSpreadsheet, FileText, Folder,
  FolderOpen, Image, ImageOff, Info, LayoutGrid, Link2, List, MapPin, Maximize,
  Music2, Pause, Pencil, PictureInPicture2, Play, Plus, RefreshCw, Scan, Search,
  SlidersHorizontal, Trash2, Video, Volume2, VolumeX, X, ZoomIn, ZoomOut,
} from 'lucide-react'
import React from 'react'

const ICONS = {
  alert: AlertTriangle,
  app: AppWindow,
  archive: FileArchive,
  at: AtSign,
  audio: Music2,
  check: Check,
  chevron: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  clipboard: ClipboardCopy,
  close: X,
  code: FileCode,
  copy: Copy,
  document: FileText,
  download: Download,
  external: ExternalLink,
  file: File,
  fileError: ImageOff,
  filter: SlidersHorizontal,
  fit: Scan,
  folder: Folder,
  folderOpen: FolderOpen,
  full: Maximize,
  grid: LayoutGrid,
  image: Image,
  info: Info,
  left: ArrowLeft,
  link: Link2,
  list: List,
  more: Ellipsis,
  mute: VolumeX,
  pause: Pause,
  pencil: Pencil,
  pip: PictureInPicture2,
  play: Play,
  plus: Plus,
  refresh: RefreshCw,
  reveal: MapPin,
  right: ArrowRight,
  search: Search,
  sheet: FileSpreadsheet,
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

/** A per-kind icon for document-like thumbnails and metadata rows. */
export function kindIcon(kind, ext = '') {
  if (kind === 'archive') return 'archive'
  if (kind === 'code') return 'code'
  if (kind === 'document') {
    if (['xls', 'xlsx', 'csv', 'tsv', 'ods'].includes(ext)) return 'sheet'
    return 'document'
  }
  if (kind === 'other') return 'file'
  return kind
}
