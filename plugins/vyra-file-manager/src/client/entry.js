/**
 * Client entry: registers the right-Sidebar tab types and bodies. The module
 * is bundled by `scripts/build-client.mjs`; React, ReactDOM, and the DSH
 * platform modules stay external and resolve through the shell's module table.
 */
import React from 'react'
import { FolderOpen } from 'lucide-react'
import counterCss from 'yet-another-react-lightbox/plugins/counter.css'
import thumbnailsCss from 'yet-another-react-lightbox/plugins/thumbnails.css'
import lightboxCss from 'yet-another-react-lightbox/styles.css'
import extraCss from './extra.css'
import pluginCss from './styles.css'
import { LibraryBody, MediaTab } from './library.js'
import { ComposerBridge } from './composer.js'
import { installDefaultTab } from './default-tab.js'
import { AUDIO_ID, AUDIO_EXT, LIBRARY_ID, LIBRARY_KIND, VIDEO_EXT, VIDEO_ID, parseFileAddress, readPrefs } from './helpers.js'

function installStyles() {
  const style = document.createElement('style')
  style.dataset.vyraMediaStudio = ''
  style.textContent = [lightboxCss, counterCss, thumbnailsCss, pluginCss, extraCss].join('\n')
  document.head.appendChild(style)
  return () => style.remove()
}

function libraryDefinition() {
  return {
    id: LIBRARY_ID,
    kind: LIBRARY_KIND,
    priority: 'extension',
    title: () => '文件管理',
    guide: [{
      id: 'library',
      order: 20,
      title: () => '文件管理',
      description: () => '浏览、预览与管理工作区文件',
      icon: FolderOpen,
    }],
  }
}

function mediaDefinition(id, kind, extensions) {
  return {
    id,
    kind,
    priority: 'extension',
    patterns: [...extensions].map(extension => `*.${extension}`),
    keepMounted: true,
    canOpen: address => parseFileAddress(address) !== undefined,
    title: address => {
      const parsed = parseFileAddress(address)
      if (parsed === undefined) return kind === 'video' ? '视频' : '音频'
      return parsed.path.split('/').pop() || (kind === 'video' ? '视频' : '音频')
    },
  }
}

const plugin = {
  name: 'dsh-vyra-file-manager',
  inject: ['slots', 'sidebarRightTabs', 'sidebarRight'],
  apply(ctx) {
    ctx.effect(() => installStyles(), 'dsh-vyra-file-manager: styles')

    // Which tab kinds exist right now. The default-tab swap reads this to see
    // whether another plugin already claimed the Sidebar's guide slot.
    const registeredKinds = new Map()
    const registerType = definition => {
      registeredKinds.set(definition.kind, definition)
      const dispose = ctx.sidebarRightTabs.register(definition)
      return () => {
        registeredKinds.delete(definition.kind)
        if (typeof dispose === 'function') dispose()
      }
    }

    const openBrowser = url => {
      try {
        ctx.sidebarRight.openTab('browser', { params: { url } })
      } catch {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
    }
    const openLibrary = () => {
      try { ctx.sidebarRight.openTab(LIBRARY_KIND) } catch { /* no Sidebar in this profile */ }
    }
    const injectFace = () => ({ openBrowser, openLibrary })

    ctx.effect(() => registerType(libraryDefinition()), 'dsh-vyra-file-manager: library type')
    ctx.effect(() => registerType(mediaDefinition(VIDEO_ID, 'video', VIDEO_EXT)), 'dsh-vyra-file-manager: video type')
    ctx.effect(() => registerType(mediaDefinition(AUDIO_ID, 'audio', AUDIO_EXT)), 'dsh-vyra-file-manager: audio type')

    ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
      name: 'sidebar.right.pane.tab', key: LIBRARY_ID, inject: injectFace,
    }, LibraryBody)), 'dsh-vyra-file-manager: library body')

    ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
      name: 'sidebar.right.pane.tab', key: VIDEO_ID, inject: injectFace,
    }, MediaTab)), 'dsh-vyra-file-manager: video body')

    ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
      name: 'sidebar.right.pane.tab', key: AUDIO_ID, inject: injectFace,
    }, MediaTab)), 'dsh-vyra-file-manager: audio body')

    // Capture the active composer so the panel can insert `@path` mentions.
    ctx.effect(() => ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
      name: 'conversation.input.left', id: 'dsh-vyra-file-manager.composer-bridge',
    }, ComposerBridge)), 'dsh-vyra-file-manager: composer bridge')

    // A Session's right Sidebar starts on the guide page; swap it for this panel
    // unless `vyra-agent-cli-manager` already owns that slot.
    ctx.effect(() => installDefaultTab({
      sidebar: ctx.sidebarRight,
      kinds: registeredKinds,
      libraryKind: LIBRARY_KIND,
      enabled: () => readPrefs().openFilesByDefault !== false,
    }), 'dsh-vyra-file-manager: files by default')
  },
}

export default plugin
