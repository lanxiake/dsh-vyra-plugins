/** Hierarchical file tree for the list view. */
import React from 'react'
import { COLLATOR, folderOf, formatBytes, formatDate, typeLabel } from './helpers.js'
import { Icon, kindIcon } from './icons.js'

const h = React.createElement

/** Build a tree from the flat scan result, keeping empty folders when asked. */
export function buildTree(items, folders, showEmptyFolders) {
  const root = { path: '', name: '', folders: new Map(), files: [], count: 0 }
  const ensure = path => {
    if (path === '') return root
    const parts = path.split('/')
    let node = root
    let current = ''
    for (const part of parts) {
      current = current === '' ? part : `${current}/${part}`
      let child = node.folders.get(part)
      if (child === undefined) {
        child = { path: current, name: part, folders: new Map(), files: [], count: 0 }
        node.folders.set(part, child)
      }
      node = child
    }
    return node
  }
  if (showEmptyFolders) {
    for (const path of folders) ensure(path)
  }
  for (const item of items) ensure(folderOf(item)).files.push(item)
  const count = node => {
    node.files.sort((left, right) => COLLATOR.compare(left.title, right.title))
    node.count = node.files.length
    for (const child of node.folders.values()) node.count += count(child)
    return node.count
  }
  count(root)
  return root
}

/** Find a node by workspace-relative folder path. */
export function findTreeNode(root, path) {
  if (path === '') return root
  let node = root
  for (const part of path.split('/')) {
    node = node.folders.get(part)
    if (node === undefined) return undefined
  }
  return node
}

function folderItem(node) {
  const slash = node.path.lastIndexOf('/')
  return {
    id: `folder:${node.path}`,
    kind: 'folder',
    title: node.name,
    name: node.name,
    fileName: node.name,
    folder: slash === -1 ? '' : node.path.slice(0, slash),
    relativePath: node.path,
    source: 'local',
    isFolder: true,
    ext: '',
    size: undefined,
    mtimeMs: 0,
  }
}

function TreeFileRow({ item, depth, detail, meta, sessionId, selected, onOpen, onToggleSelect, onMenu, dragBind, suppressClick }) {
  const detailed = detail === 'detailed'
  return h('div', {
    className: 'vms-tree-row is-file', 'data-depth': depth, 'data-detail': detailed ? 'detailed' : 'compact', 'data-selected': selected ? '' : undefined,
    style: { paddingLeft: `${10 + depth * 16}px` },
    tabIndex: 0,
    onClick: event => {
      if (suppressClick !== undefined && suppressClick()) return
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        onToggleSelect(item)
        return
      }
      onOpen(item)
    },
    onContextMenu: event => {
      event.preventDefault()
      onMenu(item, event.clientX, event.clientY)
    },
    onKeyDown: event => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      onOpen(item)
    },
    ...(dragBind === undefined ? {} : dragBind(item)),
  },
  h('span', { className: 'vms-tree-spacer' }),
  h('span', { className: 'vms-tree-file-icon', 'data-kind': item.kind }, h(Icon, { name: kindIcon(item.kind, item.ext), size: 14 })),
  h('span', { className: 'vms-tree-name' }, item.title),
  detailed && h('span', { className: 'vms-tree-meta' }, formatDate(meta?.mtimeMs)),
  detailed && h('span', { className: 'vms-tree-meta' }, typeLabel(item.kind)),
  detailed && h('span', { className: 'vms-tree-meta vms-mono' }, formatBytes(meta?.size)),
  h('button', {
    type: 'button', className: 'vms-tree-more', title: '更多操作', 'aria-label': '更多操作',
    onClick: event => {
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      onMenu(item, rect.left - 170, rect.bottom + 4)
    },
  }, h(Icon, { name: 'more', size: 13 })))
}

function TreeFolderRow({ node, depth, detail, expanded, onToggle, onMenu, dragBind, suppressClick }) {
  return h('div', {
    className: 'vms-tree-row is-folder', 'data-depth': depth, 'data-detail': detail === 'detailed' ? 'detailed' : 'compact',
    'data-vms-drop-folder': node.path,
    style: { paddingLeft: `${10 + depth * 16}px` }, tabIndex: 0,
    ...(dragBind === undefined ? {} : dragBind(folderItem(node))),
    onClick: () => { if (suppressClick !== undefined && suppressClick()) return; onToggle(node.path) },
    onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle(node.path) } },
    onContextMenu: event => {
      event.preventDefault()
      onMenu(folderItem(node), event.clientX, event.clientY)
    },
  },
  h('span', { className: 'vms-tree-chevron', 'data-expanded': expanded ? '' : undefined }, h(Icon, { name: 'chevronRight', size: 13 })),
  h('span', { className: 'vms-tree-folder-icon' }, h(Icon, { name: expanded ? 'folderOpen' : 'folder', size: 14 })),
  h('span', { className: 'vms-tree-name' }, node.name),
  detail === 'detailed' && h('span', { className: 'vms-tree-meta' }, ''),
  detail === 'detailed' && h('span', { className: 'vms-tree-meta' }, '文件夹'),
  detail === 'detailed' && h('span', { className: 'vms-tree-meta vms-mono' }, `${node.count}`),
  h('button', {
    type: 'button', className: 'vms-tree-more', title: '更多操作', 'aria-label': '更多操作',
    onClick: event => {
      event.stopPropagation()
      const rect = event.currentTarget.getBoundingClientRect()
      onMenu(folderItem(node), rect.left - 170, rect.bottom + 4)
    },
  }, h(Icon, { name: 'more', size: 13 })))
}

function renderChildren(node, depth, options) {
  const rows = []
  const folders = [...node.folders.values()].sort((left, right) => COLLATOR.compare(left.name, right.name))
  for (const child of folders) {
    const open = options.effective.has(child.path)
    rows.push(h(TreeFolderRow, {
      key: `d:${child.path}`,
      node: child,
      depth,
      detail: options.detail,
      expanded: open,
      onToggle: options.onToggleFolder,
      onMenu: options.onMenu,
      dragBind: options.dragBind,
      suppressClick: options.suppressClick,
    }))
    if (open) rows.push(...renderChildren(child, depth + 1, options))
  }
  for (const file of node.files) {
    rows.push(h(TreeFileRow, {
      key: file.id,
      item: file,
      depth,
      detail: options.detail,
      meta: options.meta?.[file.id],
      sessionId: options.sessionId,
      selected: options.selected.has(file.id),
      onOpen: options.onOpen,
      onToggleSelect: options.onToggleSelect,
      onMenu: options.onMenu,
      dragBind: options.dragBind,
      suppressClick: options.suppressClick,
    }))
  }
  return rows
}

/**
 * Render the tree for the current folder scope.
 * @param {object} props - tree inputs.
 */
export function FileTree({
  items, folders, scope, expanded = new Set(), forceExpanded = new Set(), collapsed = new Set(), detail, meta, sessionId,
  selected = new Set(), showEmptyFolders, onToggleFolder, onOpen, onToggleSelect, onMenu, dragBind, suppressClick,
}) {
  const tree = React.useMemo(() => buildTree(items, folders, showEmptyFolders), [items, folders, showEmptyFolders])
  const scoped = React.useMemo(() => findTreeNode(tree, scope), [tree, scope])
  const start = scoped ?? tree
  const effective = React.useMemo(() => {
    const set = new Set(expanded)
    if (scope !== '') set.add(scope)
    for (const path of forceExpanded) set.add(path)
    // An explicit collapse wins over the filter's automatic expansion, so the
    // chevron still works while a filter is active.
    for (const path of collapsed) set.delete(path)
    return set
  }, [expanded, forceExpanded, collapsed, scope])
  if (scope !== '' && scoped === undefined) {
    return h('div', { className: 'vms-tree is-empty' }, '这个文件夹没有匹配的文件')
  }
  const rows = renderChildren(start, 0, {
    detail, meta, sessionId, selected, onOpen, onToggleSelect, onMenu,
    effective, onToggleFolder, dragBind, suppressClick,
  })
  if (rows.length === 0) {
    return h('div', { className: 'vms-tree is-empty' }, '这个文件夹没有匹配的文件')
  }
  return h('div', { className: 'vms-tree', role: 'tree' }, rows)
}