/**
 * dsh-vyra-screen-recorder — 浏览器端：工具条按钮、录制源选择、截图标注与编码。
 *
 * 编码全部在浏览器里做：宿主只给 JPEG 帧和 WAV，WebCodecs 编 VP9 + Opus，
 * 再用内置 webm-muxer 封装成单个 .webm。这样不需要 Python / ffmpeg。
 */
window.__ModuleLoader__.load({
  id: 'dsh-vyra-screen-recorder',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement
    const { useEffect, useMemo, useRef, useState } = React

    // ------------------------------------------------------------------ vendor
    const WebMMuxer = (function () {
      const module = { exports: {} }
      /*__WEBM_MUXER__*/
      return module.exports
    })()
    const Mp4Muxer = (function () {
      const module = { exports: {} }
      /*__MP4_MUXER__*/
      return module.exports
    })()

    // ---------------------------------------------------------------- constants
    const PREFIX = '/plugins/vyra-screen-recorder'
    const ZH = (navigator.language || 'zh').toLowerCase().startsWith('zh')
    const L = (zh, en) => (ZH ? zh : en)
    const S = {
      record: L('录屏', 'Record screen'),
      stop: L('停止录屏', 'Stop recording'),
      screenshot: L('截图', 'Screenshot'),
      pickerTitle: L('选择要录制的内容', 'Choose what to record'),
      desktop: L('整个桌面', 'Entire desktop'),
      monitors: L('显示器', 'Displays'),
      windows: L('窗口', 'Windows'),
      custom: L('自定义区域…', 'Custom region…'),
      customHint: L('拖框选择要录制的区域', 'Drag to choose a region'),
      customHintShot: L('拖框选择要截图的区域', 'Drag to choose a region to capture'),
      shotPickerTitle: L('选择要截图的内容', 'Choose what to capture'),
      shotPickerHint: L('选好后在截图上拖框；单击选整块', 'Pick one, then drag on the capture; click for the whole area'),
      primary: L('主屏', 'Primary'),
      systemAudio: L('系统声音', 'System audio'),
      microphone: L('麦克风', 'Microphone'),
      hint: L('8 fps · 最长 10 分钟 · 窗口录制会录到遮挡物', '8 fps · up to 10 minutes · window capture includes occluders'),
      close: L('关闭', 'Close'),
      preparing: L('正在准备录制…', 'Preparing recording…'),
      recording: L('录制中', 'Recording'),
      encoding: L('正在编码…', 'Encoding…'),
      openingFolder: L('打开文件夹', 'Open folder'),
      shotHint: L('拖框选择截图区域，单击选整屏；Esc 取消', 'Drag to select; click for full screen; Esc cancels'),
      regionHint: L('拖框选择要录制的区域；Esc 取消', 'Drag to choose the recording region; Esc cancels'),
      useShot: L('用这张', 'Use this'),
      recordRegion: L('录制这块区域', 'Record this region'),
      cancel: L('取消', 'Cancel'),
      reselect: L('重选区域', 'Reselect'),
      undo: L('撤销', 'Undo'),
      clear: L('清空', 'Clear'),
      pen: L('画笔', 'Pen'),
      rect: L('矩形', 'Rectangle'),
      arrow: L('箭头', 'Arrow'),
      text: L('文字', 'Text'),
      noFrames: L('没有录到画面', 'No frames were captured'),
      noRoute: L('宿主路由不可用，请完整重启 DSH 后再试', 'Host routes unavailable; fully restart DSH'),
      // 工具条悬停提示：一行主标题 + 一行可选的快捷键组合（VS Code 风格）。
      recordTip: L('录制屏幕', 'Record screen'),
      stopTip: L('停止录制', 'Stop recording'),
      shotTip: L('截图', 'Screenshot'),
      // 截图浮层：取字与复制。
      extractText: L('提取文字', 'Extract text'),
      extracting: L('正在识别文字…', 'Recognizing text…'),
      extractingProgress: L('正在识别文字', 'Recognizing text'),
      copyText: L('复制文字', 'Copy text'),
      copied: L('已复制', 'Copied'),
      noText: L('没有识别到文字', 'No text found'),
      textPanelTitle: L('文字', 'Text'),
      copyImage: L('复制图片', 'Copy image'),
      copyImageDone: L('图片已复制', 'Image copied'),
      copyFile: L('复制文件', 'Copy file'),
      copyFileDone: L('文件已复制', 'File copied'),
      pasteHint: L('粘贴到聊天窗口或资源管理器', 'Paste into a chat or Explorer'),
      textFailed: L('识别文字失败：', 'Text extraction failed: '),
      copyFailed: L('复制失败：', 'Copy failed: '),
      ocrUnavailable: L('系统 OCR 不可用，请在设置里检查识别语言包', 'System OCR unavailable; check the OCR language pack'),
      ocrCharacters: (count) => L('识别出 ' + count + ' 个字符', count + ' characters'),
      hideTextPanel: L('收起文字面板', 'Hide text panel'),
      showTextPanel: L('展开文字面板（可以选中复制）', 'Show text panel'),
    }

    const DEFAULT_SETTINGS = {
      dir: '',
      videoDir: '',
      shotDir: '',
      format: 'mp4',
      fps: 8,
      quality: 65,
      maxEdge: 1920,
      maxSeconds: 600,
      includeSystemAudio: true,
      includeMic: true,
      // 截图不再提供「隐藏 DSH 界面」开关：截图浮层本身会遮住界面，
      // 需要截取全屏就按快捷键直接抓，界面上再挂一个开关只会增加困惑。
      shortcuts: {
        screenshot: 'Ctrl+Alt+S',
        record: 'Ctrl+Alt+R',
        copyImage: 'Ctrl',
        clipboard: 'Ctrl+Shift+C',
        text: 'Ctrl+Alt+C',
        save: 'Ctrl+S',
      },
      ocr: { engine: 'auto', lang: 'system', scale: 2 },
    }

    // ------------------------------------------------------------------- store
    let state = {
      phase: 'idle', // idle | picking | starting | recording | encoding
      picker: null,
      shot: null,
      recording: null,
      progress: null,
      toast: null,
      agentRecording: null,
      settings: DEFAULT_SETTINGS,
      paths: null,
    }
    const listeners = new Set()
    function getState() { return state }
    function setState(patch) {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
      for (const listener of [...listeners]) { try { listener() } catch { /* ignore */ } }
    }
    function subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    }
    function useStore() {
      const [snapshot, setSnapshot] = useState(getState())
      useEffect(() => subscribe(() => setSnapshot(getState())), [])
      return snapshot
    }
    function useNow(active) {
      const [now, setNow] = useState(Date.now())
      useEffect(() => {
        if (!active) return undefined
        setNow(Date.now())
        const timer = setInterval(() => setNow(Date.now()), 500)
        return () => clearInterval(timer)
      }, [active])
      return now
    }

    let toastTimer = null
    function toast(text, options) {
      const value = options || {}
      setState({ toast: { text, kind: value.kind || 'info', path: value.path || '', dir: value.dir || '', id: Date.now() } })
      if (toastTimer !== null) clearTimeout(toastTimer)
      toastTimer = setTimeout(() => setState({ toast: null }), value.kind === 'error' ? 9000 : 5000)
    }

    function friendly(error) {
      const message = String((error && error.message) || error || '')
      if (/Failed to fetch|NetworkError|fetch failed|Load failed/i.test(message)) return S.noRoute
      return message || S.noRoute
    }

    async function apiJson(suffix, options) {
      let response
      try {
        response = await fetch(PREFIX + suffix, { cache: 'no-store', ...(options || {}) })
      } catch (error) {
        throw new Error(S.noRoute)
      }
      const text = await response.text()
      let data = {}
      try { data = text ? JSON.parse(text) : {} } catch { /* non-JSON error */ }
      if (!response.ok || data.ok === false) throw new Error(data.error || text.slice(0, 200) || ('HTTP ' + response.status))
      return data
    }

    async function uploadBlob(blob, name, kind) {
      const response = await fetch(PREFIX + '/record/save?kind=' + (kind === 'image' ? 'image' : 'video') + '&name=' + encodeURIComponent(name), {
        method: 'POST',
        body: blob,
      })
      const text = await response.text()
      let data = {}
      try { data = text ? JSON.parse(text) : {} } catch { /* ignore */ }
      if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + response.status))
      return data
    }

    async function loadClientSettings() {
      try {
        const data = await apiJson('/settings')
        setState({ settings: data.settings || DEFAULT_SETTINGS, paths: data.paths || null })
      } catch { /* 保留默认值 */ }
    }

    // ------------------------------------------------------- OCR 与剪贴板
    // 截图浮层的「提取文字」把选中的那块图发给宿主，宿主用 dsh-tool-ocr 配的
    // 引擎（没有配置时用系统自带的 Windows OCR）识别，返回文字和每行位置。
    async function ocrRegion(blob) {
      const response = await fetch(PREFIX + '/ocr', { method: 'POST', body: blob })
      const text = await response.text()
      let data = {}
      try { data = text ? JSON.parse(text) : {} } catch { /* ignore */ }
      if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + response.status))
      return data
    }

    /**
     * 把图片/文字/文件列表放进系统剪贴板。
     *
     * @param {'image'|'text'|'files'} kind - 剪贴板内容类型。
     * @param {{blob?: Blob, name?: string, text?: string, path?: string}} value - 内容或已保存文件路径。
     */
    async function putClipboard(kind, value) {
      const query = '?kind=' + kind
        + (value && value.name ? '&name=' + encodeURIComponent(value.name) : '')
        + (value && value.path ? '&path=' + encodeURIComponent(value.path) : '')
      let body
      if (kind === 'text') body = new Blob([(value && value.text) || ''], { type: 'text/plain;charset=utf-8' })
      else if (value && value.blob) body = value.blob
      const response = await fetch(PREFIX + '/clipboard' + query, { method: 'POST', body })
      const text = await response.text()
      let data = {}
      try { data = text ? JSON.parse(text) : {} } catch { /* ignore */ }
      if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + response.status))
      return data
    }

    /** 用系统默认程序打开已保存的图片。 */
    async function openFile(pathValue) {
      const response = await fetch(PREFIX + '/open?path=' + encodeURIComponent(pathValue), { cache: 'no-store' })
      const text = await response.text()
      let data = {}
      try { data = text ? JSON.parse(text) : {} } catch { /* ignore */ }
      if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + response.status))
      return data
    }

    /** 把剪贴板成功的结果写进提示条；失败时说明卡在哪。 */
    function copiedToast(kind) {
      const label = kind === 'text' ? S.copyText : kind === 'files' ? S.copyFile : S.copyImage
      toast(label + L('：', ': ') + L('已放进剪贴板', 'copied to the clipboard') + ' · ' + S.pasteHint, { kind: 'success' })
    }

    // ------------------------------------------------------------- formatting
    function pad(value) { return String(value).padStart(2, '0') }
    function formatDuration(seconds) {
      const safe = Math.max(0, Math.floor(seconds))
      return pad(Math.floor(safe / 60)) + ':' + pad(safe % 60)
    }
    function stamp() {
      const now = new Date()
      return String(now.getFullYear()) + pad(now.getMonth() + 1) + pad(now.getDate())
        + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds())
    }
    function loadImage(url) {
      return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error(L('图片加载失败', 'Image failed to load')))
        image.src = url
      })
    }
    function sourceKey(choice) {
      if (!choice) return ''
      if (choice.type === 'window') return 'window:' + choice.hwnd
      if (choice.type === 'region') return 'region'
      if (choice.type === 'monitor') return 'monitor:' + (choice.name || (choice.x + ',' + choice.y))
      return 'desktop'
    }

    // ------------------------------------------------------------- shortcuts
    // 快手显示：把宿主解析好的组合渲染成 "Ctrl+Alt+S"，提示里用它。
    // 只做展示，匹配仍由 matchesShortcut 按事件本身判断。
    function shortcutParts(combo) {
      const text = typeof combo === 'string' ? combo.trim() : ''
      if (!text) return []
      const parts = text.split(/[+\s]+/).filter(Boolean)
      const tokens = parts.length > 1 ? parts : (text.match(/ctrl|alt|shift|meta|[^+]?[A-Za-z0-9]/gi) || [])
      const names = { ctrl: 'Ctrl', control: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Meta', cmd: 'Meta' }
      const out = []
      let key = ''
      for (const token of tokens) {
        const mapped = names[token.toLowerCase()]
        if (mapped) { if (!out.includes(mapped)) out.push(mapped); continue }
        key = token
      }
      if (key) out.push(key === ' ' || key.toLowerCase() === 'space' ? 'Space' : key.toUpperCase())
      return out
    }

    /** "Ctrl+Alt+S" 这种纯文本形式，给原生 title 用。 */
    function formatCombo(combo) {
      return shortcutParts(combo).join('+')
    }

    /** 提示条上的按键帽：一个键一个方框，而不是 "Ctrl+Alt+S" 一串文字。 */
    function ShortcutKeys(props) {
      const parts = shortcutParts(props.combo)
      if (parts.length === 0) return null
      return h('span', { className: 'vsr-tip-keys' },
        ...parts.map((part, index) => h('kbd', { key: index, className: 'vsr-kbd' }, part)))
    }

    /**
     * 鼠标悬停提示：主标题一行，可选快捷键一行。
     * 用自绘的提示而不是原生 title——原生提示的延迟、字体、按键帽都没法控制，
     * 也不好看；这里和 VS Code 的悬停一致：上方居中、深色、带按键帽。
     */
    function Tip(props) {
      if (!props.label) return null
      return h('span', { className: 'vsr-tip' + (props.align === 'end' ? ' vsr-tip-end' : ''), role: 'tooltip', 'aria-hidden': 'true' },
        h('span', { className: 'vsr-tip-body' },
          h('span', { className: 'vsr-tip-label' }, props.label),
          props.shortcut ? h(ShortcutKeys, { combo: props.shortcut }) : null,
          props.hint ? h('span', { className: 'vsr-tip-hint' }, props.hint) : null))
    }

    // ------------------------------------------------------------- recording
    let timerHandle = null
    let pollHandle = null
    let finishing = false
    let agentRun = null
    let agentPollTimer = null
    // 截图/选源都必须先抓屏、后出界面：抓屏期间屏幕上不能出现任何本插件 UI，
    // 否则 GDI 会把加载提示、弹窗一起拍进图里，也拖慢到不像原生截图。
    let captureBusy = false

    function stopTimers() {
      if (timerHandle !== null) { clearInterval(timerHandle); timerHandle = null }
      if (pollHandle !== null) { clearInterval(pollHandle); pollHandle = null }
    }

    function startPolling() {
      if (pollHandle !== null) clearInterval(pollHandle)
      pollHandle = setInterval(async () => {
        try {
          const status = await apiJson('/record/status')
          if (state.phase === 'recording' && status.recording === false && !finishing) {
            finishing = true
            stopRecording().finally(() => { finishing = false })
          }
        } catch { /* 宿主临时不可达时继续等下一轮 */ }
      }, 2000)
    }

    /** 抓一张屏幕底图；抓之前先藏起本插件的浮层，抓完再恢复。 */
    async function fetchShot(query) {
      document.documentElement.classList.add('vsr-capturing')
      try {
        // 等两帧，确保 visibility:hidden 已经真正画到屏幕上；窗口被挂起时用超时兜底。
        await new Promise(resolve => {
          let done = false
          const finish = () => { if (!done) { done = true; resolve() } }
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => requestAnimationFrame(finish))
          }
          setTimeout(finish, 80)
        })
        let response
        try { response = await fetch(PREFIX + '/shot' + (query || ''), { cache: 'no-store' }) } catch { throw new Error(S.noRoute) }
        if (!response.ok) throw new Error('HTTP ' + response.status)
        return {
          blob: await response.blob(),
          hidden: response.headers.get('x-vsr-hidden') === '1',
        }
      } finally {
        document.documentElement.classList.remove('vsr-capturing')
      }
    }

    /**
     * 打开源选择框。
     *
     * @param {'record'|'shot'} mode - record 选完直接开录；shot 选完进截图浮层，
     *   让用户再拖框（「像录制屏幕一样先决定内容」）。
     */
    async function openPicker(mode) {
      if (state.phase !== 'idle' || captureBusy) return
      captureBusy = true
      setState({ toast: null })
      try {
        const [sources, shot] = await Promise.all([
          apiJson('/sources'),
          fetchShot('?ts=' + Date.now()),
        ])
        const url = URL.createObjectURL(shot.blob)
        const image = await loadImage(url)
        setState({
          phase: 'picking',
          picker: {
            mode: mode === 'shot' ? 'shot' : 'record',
            loading: false,
            error: '',
            sources,
            shotUrl: url,
            shotW: image.naturalWidth,
            shotH: image.naturalHeight,
          },
        })
      } catch (error) {
        toast(L('无法打开录制源：', 'Cannot open recording sources: ') + friendly(error), { kind: 'error' })
      } finally {
        captureBusy = false
      }
    }

    function closePicker() {
      const picker = state.picker
      if (picker && picker.shotUrl) URL.revokeObjectURL(picker.shotUrl)
      setState({ phase: 'idle', picker: null })
    }

    function closeShot() {
      const shot = state.shot
      if (shot && shot.url) URL.revokeObjectURL(shot.url)
      setState({ shot: null })
    }

    async function startMic() {
      const startedAt = Date.now()
      try {
        const media = navigator.mediaDevices
        if (!media || typeof media.getUserMedia !== 'function') throw new Error('no mediaDevices')
        const stream = await media.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        })
        const mimeType = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : ''
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
        const chunks = []
        recorder.ondataavailable = event => { if (event.data && event.data.size > 0) chunks.push(event.data) }
        recorder.start(1000)
        return { stream, recorder, chunks, startedAt }
      } catch {
        return null
      }
    }

    function stopMic(mic) {
      if (mic === null || mic === undefined) return Promise.resolve(null)
      return new Promise(resolve => {
        let settled = false
        const finish = () => {
          if (settled) return
          settled = true
          try { mic.stream.getTracks().forEach(track => track.stop()) } catch { /* ignore */ }
          resolve(mic.chunks.length ? new Blob(mic.chunks, { type: mic.recorder.mimeType || 'audio/webm' }) : null)
        }
        try {
          if (mic.recorder.state === 'inactive') { finish(); return }
          mic.recorder.onstop = finish
          mic.recorder.stop()
          setTimeout(finish, 2000)
        } catch { finish() }
      })
    }

    async function startRecording(choice, options) {
      const value = options || {}
      const settings = state.settings || DEFAULT_SETTINGS
      closePicker()
      if (state.shot) closeShot()
      setState({ phase: 'starting', progress: { stage: S.preparing, ratio: 0 }, recording: null })
      let mic = null
      if (value.includeMic !== false) mic = await startMic()
      try {
        const result = await apiJson('/record/start', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            source: choice,
            fps: settings.fps,
            quality: settings.quality,
            maxEdge: settings.maxEdge,
            maxSeconds: settings.maxSeconds,
            includeSystemAudio: value.includeSystemAudio !== undefined ? value.includeSystemAudio : settings.includeSystemAudio,
          }),
        })
        if (mic === null && value.includeMic !== false) {
          toast(L('麦克风不可用，本次只录系统声音', 'Microphone unavailable; recording system audio only'), { kind: 'error' })
        }
        if (value.includeSystemAudio !== false && result.hasAudio === false) {
          toast(L('系统声音不可用，已录制无声视频', 'System audio unavailable; recording without sound'), { kind: 'error' })
        }
        try { localStorage.setItem('vsr.lastSource', JSON.stringify(choice)) } catch { /* ignore */ }
        setState({
          phase: 'recording',
          progress: null,
          recording: {
            sessionId: result.sessionId,
            startedAt: result.startedAt || Date.now(),
            hasAudio: result.hasAudio,
            mic,
          },
        })
        startPolling()
      } catch (error) {
        await stopMic(mic)
        setState({ phase: 'idle', progress: null, recording: null })
        toast(L('开始录制失败：', 'Failed to start recording: ') + friendly(error), { kind: 'error' })
      }
    }

    async function stopRecording() {
      if (state.phase !== 'recording') return
      const recording = state.recording
      stopTimers()
      setState({ phase: 'encoding', progress: { stage: L('正在生成视频…', 'Encoding video…'), ratio: 0.02 } })
      const micBlob = await stopMic(recording ? recording.mic : null)
      let manifest = null
      try {
        manifest = await apiJson('/record/stop', { method: 'POST' })
        const format = (state.settings && state.settings.format) || 'mp4'
        const encoded = await encodeRecording(manifest, micBlob, recording, format)
        if (encoded.fallback) toast(L('当前环境不支持 H.264/AAC，已保存为 WebM', 'H.264/AAC unavailable; saved as WebM'), { kind: 'error' })
        const name = encoded.name
        setState({ progress: { stage: L('正在保存…', 'Saving…'), ratio: 0.97 } })
        let saved = null
        try {
          saved = await uploadBlob(encoded.blob, name, 'video')
        } catch (error) {
          downloadBlob(encoded.blob, name)
          toast(L('保存到磁盘失败，已改为浏览器下载：', 'Save failed; downloaded instead: ') + friendly(error), { kind: 'error' })
        }
        // 录屏不再自动挂进输入框：想发给 Agent 再手动拖进去，不想要就直接用文件。
        if (saved) {
          toast(L('录屏已保存', 'Recording saved'), { kind: 'success', path: saved.file, dir: saved.dir })
        }
        await fetch(PREFIX + '/record/discard', { method: 'POST' }).catch(() => {})
      } catch (error) {
        toast(L('录屏失败：', 'Recording failed: ') + friendly(error), { kind: 'error' })
        await fetch(PREFIX + '/record/discard', { method: 'POST' }).catch(() => {})
      } finally {
        setState({ phase: 'idle', recording: null, progress: null })
      }
    }

    async function pollAgent() {
      let status
      try { status = await apiJson('/agent/status') } catch { return }
      const job = status.job
      if (!job) {
        if (agentRun && !agentRun.encoding) {
          await stopMic(agentRun.mic)
          agentRun = null
          setState({ agentRecording: null })
        }
        return
      }
      if (job.status === 'recording') {
        if (agentRun === null || agentRun.id !== job.id) {
          if (agentRun) await stopMic(agentRun.mic)
          agentRun = { id: job.id, mic: null, micStartedAt: Date.now(), encoding: false, startingMic: true }
          setState({ agentRecording: { id: job.id, startedAt: job.startedAt || Date.now() } })
          const mic = job.includeMic === false ? null : await startMic()
          if (agentRun !== null && agentRun.id === job.id) {
            agentRun.mic = mic
            agentRun.micStartedAt = mic ? mic.startedAt : Date.now()
            agentRun.startingMic = false
          } else {
            await stopMic(mic)
          }
        }
        return
      }
      if (job.status === 'encoding') {
        if (agentRun === null || agentRun.id !== job.id) {
          agentRun = { id: job.id, mic: null, micStartedAt: Date.now(), encoding: false }
        }
        if (agentRun.encoding) return
        agentRun.encoding = true
        setState({ agentRecording: null, phase: 'encoding', progress: { stage: L('Agent 录屏编码中…', 'Encoding agent recording…'), ratio: 0.05 } })
        const micBlob = await stopMic(agentRun.mic)
        try {
          const encoded = await encodeRecording(job.manifest, micBlob, { mic: { startedAt: agentRun.micStartedAt } }, job.format || 'mp4')
          const response = await fetch(PREFIX + '/agent/save?id=' + encodeURIComponent(job.id) + '&format=' + encodeURIComponent(encoded.format), { method: 'POST', body: encoded.blob })
          const text = await response.text()
          let data = {}
          try { data = text ? JSON.parse(text) : {} } catch { /* ignore */ }
          if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + response.status))
          toast(L('Agent 录屏已保存：', 'Agent recording saved: ') + data.file, { kind: 'success', path: data.file, dir: data.dir })
        } catch (error) {
          await fetch(PREFIX + '/agent/error?id=' + encodeURIComponent(job.id), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ error: String((error && error.message) || error) }),
          }).catch(() => {})
          toast(L('Agent 录屏失败：', 'Agent recording failed: ') + friendly(error), { kind: 'error' })
        } finally {
          agentRun = null
          setState({ phase: 'idle', progress: null, agentRecording: null })
        }
      }
    }

    function startAgentWatch() {
      if (agentPollTimer !== null) return
      agentPollTimer = setInterval(() => { void pollAgent() }, 2000)
      void pollAgent()
    }

    function stopAgentWatch() {
      if (agentPollTimer !== null) {
        clearInterval(agentPollTimer)
        agentPollTimer = null
      }
      if (agentRun !== null) {
        void stopMic(agentRun.mic)
        agentRun = null
      }
    }

    /**
     * 截图入口（工具条按钮）。
     *
     * 按钮点击走"先选源"：和录屏一样先让用户决定截哪块。
     */
    async function takeScreenshot() {
      if (state.phase !== 'idle' || captureBusy) return
      await openPicker('shot')
    }

    /**
     * 快捷键截图入口：不选源，直接抓整个屏幕进选区，像 QQ / 微信那样。
     *
     * 快捷键是"我马上要截"，多一步选源就慢半拍；想截某个窗口的用户
     * 仍然可以点工具条按钮走选源流程。
     */
    async function takeScreenshotQuick() {
      if (state.phase !== 'idle' || captureBusy) return
      captureBusy = true
      setState({ toast: null })
      try {
        const shot = await fetchShot('?ts=' + Date.now())
        const url = URL.createObjectURL(shot.blob)
        const image = await loadImage(url)
        setState({
          phase: 'idle',
          picker: null,
          shot: {
            mode: 'shot',
            url,
            imageW: image.naturalWidth,
            imageH: image.naturalHeight,
            virtual: null,
            crop: null,
            options: null,
          },
        })
      } catch (error) {
        toast(L('截图失败：', 'Screenshot failed: ') + friendly(error), { kind: 'error' })
      } finally {
        captureBusy = false
      }
    }

    function openRegionShot(picker, options) {
      if (!picker || !picker.shotUrl) return
      setState({
        phase: 'idle',
        picker: null,
        toast: null,
        shot: {
          mode: 'region',
          url: picker.shotUrl,
          imageW: picker.shotW,
          imageH: picker.shotH,
          virtual: picker.sources.virtual,
          options,
        },
      })
    }

    /**
     * 截图：按选中的源进入截图浮层。
     *
     * 底图仍是整张虚拟桌面（抓一次就够），但把「可选范围」收窄到用户选的
     * 显示器 / 窗口 / 自定义区域：浮层只显示这一块，拖框也只能在这一块里。
     * 这样和录屏的操作一致——先决定内容，再圈细节。
     *
     * @param {object} picker - 源选择框状态（含底图 URL 与虚拟桌面矩形）。
     * @param {{type: string, x?: number, y?: number, w?: number, h?: number}} choice - 用户选的源。
     * @param {object} thumbnailRect - 该源在虚拟桌面上的矩形。
     * @param {object} options - 保留字段（截图不用音频设置）。
     */
    function openShotOverlay(picker, choice, thumbnailRect, options) {
      if (!picker || !picker.shotUrl) return
      const virtual = picker.sources.virtual
      const bounds = (choice && choice.type !== 'desktop' && thumbnailRect)
        ? { x: thumbnailRect.x, y: thumbnailRect.y, w: thumbnailRect.w, h: thumbnailRect.h }
        : { x: virtual.x, y: virtual.y, w: virtual.w, h: virtual.h }
      setState({
        phase: 'idle',
        picker: null,
        toast: null,
        shot: {
          mode: 'shot',
          url: picker.shotUrl,
          imageW: picker.shotW,
          imageH: picker.shotH,
          virtual,
          // 底图里这块裁剪区（虚拟桌面坐标系）。
          crop: bounds,
          sourceLabel: choice && choice.type === 'window'
            ? (choice.title || L('窗口', 'Window'))
            : choice && choice.type === 'monitor'
              ? (choice.name || L('显示器', 'Display'))
              : L('整个桌面', 'Entire desktop'),
        options: options || null,
        },
      })
    }

    // -------------------------------------------------------------- encoding
    function pickVideoCodec(width, height, fps, format) {
      const bitrate = Math.min(8000000, Math.max(1500000, Math.round(width * height * fps * 0.1)))
      return (async () => {
        if (typeof VideoEncoder === 'undefined') throw new Error(L('当前环境不支持 WebCodecs', 'WebCodecs unavailable'))
        if (format === 'mp4') {
          try {
            const pixels = width * height
            const level = pixels > 1920 * 1080 ? '32' : pixels > 1280 * 720 ? '28' : '1f'
            const config = { codec: 'avc1.4200' + level, width, height, bitrate, framerate: fps, avc: { format: 'avc' } }
            const support = await VideoEncoder.isConfigSupported(config)
            if (support && support.supported) {
              return {
                container: 'mp4',
                muxerCodec: 'avc',
                config: { ...config, ...(support.config || {}), avc: { format: 'avc' } },
                bitrate,
                extension: 'mp4',
              }
            }
          } catch { /* fall through to WebM */ }
        }
        const candidates = [
          { container: 'webm', muxerCodec: 'V_VP9', codec: 'vp09.00.10.08' },
          { container: 'webm', muxerCodec: 'V_VP8', codec: 'vp8' },
        ]
        for (const candidate of candidates) {
          try {
            const support = await VideoEncoder.isConfigSupported({
              codec: candidate.codec, width, height, bitrate, framerate: fps,
            })
            if (support && support.supported) {
              return {
                container: 'webm',
                muxerCodec: candidate.muxerCodec,
                config: support.config || { codec: candidate.codec, width, height, bitrate, framerate: fps },
                bitrate,
                extension: 'webm',
              }
            }
          } catch { /* try next */ }
        }
        throw new Error(L('没有可用的视频编码器', 'No video encoder available'))
      })()
    }

    async function pickAudioCodec(container) {
      if (typeof AudioEncoder === 'undefined') return null
      const codec = container === 'mp4' ? 'mp4a.40.2' : 'opus'
      try {
        const support = await AudioEncoder.isConfigSupported({
          codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 128000,
        })
        if (support && support.supported) {
          return {
            muxerCodec: container === 'mp4' ? 'aac' : 'opus',
            config: { codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 },
          }
        }
      } catch { /* no audio */ }
      return null
    }

    async function mixAudio(manifest, micBlob, recording) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return null
      const durationMs = Math.max(200, manifest.durationMs || 0)
      let systemBuffer = null
      let micBuffer = null
      const context = new AudioContextClass()
      try {
        if (manifest.audio) {
          try {
            const response = await fetch(PREFIX + '/record/audio?session=' + encodeURIComponent(manifest.sessionId), { cache: 'no-store' })
            if (response.ok) {
              const data = await response.arrayBuffer()
              if (data.byteLength > 44) systemBuffer = await context.decodeAudioData(data)
            }
          } catch { /* 没有系统声音 */ }
        }
        if (micBlob) {
          try {
            const data = await micBlob.arrayBuffer()
            if (data.byteLength > 0) micBuffer = await context.decodeAudioData(data)
          } catch { /* 麦克风解码失败时只保留系统声音 */ }
        }
      } finally {
        try { await context.close() } catch { /* ignore */ }
      }
      if (systemBuffer === null && micBuffer === null) return null
      const sampleRate = 48000
      const frames = Math.max(1, Math.ceil((durationMs / 1000) * sampleRate))
      const offline = new OfflineAudioContext(2, frames, sampleRate)
      const addSource = (buffer, offsetMs) => {
        const source = offline.createBufferSource()
        source.buffer = buffer
        source.connect(offline.destination)
        const skip = Math.max(0, -offsetMs / 1000)
        const when = Math.max(0, offsetMs / 1000)
        source.start(when, skip)
      }
      if (systemBuffer) addSource(systemBuffer, manifest.audioOffsetMs || 0)
      if (micBuffer) addSource(micBuffer, (recording && recording.mic ? recording.mic.startedAt : manifest.startedAt) - manifest.startedAt)
      try { return await offline.startRendering() } catch { return null }
    }

    async function encodeRecording(manifest, micBlob, recording, format) {
      const frames = manifest.frames || []
      if (frames.length === 0) throw new Error(S.noFrames)
      const width = manifest.width || 1280
      const height = manifest.height || 720
      const fps = manifest.fps || 8
      const requested = format === 'webm' ? 'webm' : 'mp4'
      setState({ progress: { stage: L('正在混音…', 'Mixing audio…'), ratio: 0.05 } })
      const mixed = await mixAudio(manifest, micBlob, recording)
      let videoCodec = await pickVideoCodec(width, height, fps, requested)
      let audioCodec = mixed ? await pickAudioCodec(videoCodec.container) : null
      let fallback = ''
      if (requested === 'mp4' && videoCodec.container !== 'mp4') fallback = 'no-h264'
      if (mixed && audioCodec === null && videoCodec.container === 'mp4') {
        videoCodec = await pickVideoCodec(width, height, fps, 'webm')
        audioCodec = await pickAudioCodec('webm')
        fallback = 'no-aac'
      }
      const target = videoCodec.container === 'mp4'
        ? new Mp4Muxer.ArrayBufferTarget()
        : new WebMMuxer.ArrayBufferTarget()
      const muxer = videoCodec.container === 'mp4'
        ? new Mp4Muxer.Muxer({
          target,
          video: { codec: 'avc', width, height },
          ...(mixed && audioCodec ? { audio: { codec: 'aac', sampleRate: 48000, numberOfChannels: 2 } } : {}),
          fastStart: 'in-memory',
          firstTimestampBehavior: 'offset',
        })
        : new WebMMuxer.Muxer({
          target,
          video: { codec: videoCodec.muxerCodec, width, height, frameRate: fps },
          ...(mixed && audioCodec ? { audio: { codec: 'A_OPUS', sampleRate: 48000, numberOfChannels: 2 } } : {}),
          firstTimestampBehavior: 'offset',
        })

      let videoError = null
      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta) } catch (error) { videoError = error } },
        error: error => { videoError = error },
      })
      videoEncoder.configure({
        ...videoCodec.config,
        width,
        height,
        bitrate: videoCodec.bitrate,
        framerate: fps,
        latencyMode: 'quality',
      })

      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d', { alpha: false })
      const keyEvery = Math.max(1, Math.round(fps * 2))
      try {
        for (let index = 0; index < frames.length; index++) {
          if (videoError) throw videoError
          const row = frames[index]
          const url = PREFIX + '/record/frame?session=' + encodeURIComponent(manifest.sessionId) + '&file=' + encodeURIComponent(row.file)
          let response
          try { response = await fetch(url, { cache: 'no-store' }) } catch { throw new Error(S.noRoute) }
          if (!response.ok) throw new Error(L('读取第 ', 'Failed to read frame ') + (index + 1) + L(' 帧失败', ''))
          const bitmap = await createImageBitmap(await response.blob())
          ctx.drawImage(bitmap, 0, 0, width, height)
          bitmap.close()
          const timestamp = Math.max(0, Math.round(row.t * 1000))
          const next = index + 1 < frames.length ? frames[index + 1].t : manifest.durationMs
          const duration = Math.max(1000, Math.round((next - row.t) * 1000))
          const frame = new VideoFrame(canvas, { timestamp, duration })
          videoEncoder.encode(frame, { keyFrame: index % keyEvery === 0 })
          frame.close()
          if (videoEncoder.encodeQueueSize > 8) await new Promise(resolve => setTimeout(resolve, 10))
          if (index % 5 === 0) {
            setState({ progress: { stage: L('正在编码画面…', 'Encoding video…'), ratio: 0.1 + (index / frames.length) * 0.72 } })
          }
        }
        await videoEncoder.flush()
      } finally {
        try { videoEncoder.close() } catch { /* ignore */ }
      }
      if (videoError) throw videoError

      if (mixed && audioCodec) {
        setState({ progress: { stage: L('正在编码声音…', 'Encoding audio…'), ratio: 0.84 } })
        let audioError = null
        const audioEncoder = new AudioEncoder({
          output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta) } catch (error) { audioError = error } },
          error: error => { audioError = error },
        })
        audioEncoder.configure(audioCodec.config)
        try {
          const left = mixed.getChannelData(0)
          const right = mixed.numberOfChannels > 1 ? mixed.getChannelData(1) : left
          const chunkFrames = 960
          for (let offset = 0; offset < mixed.length; offset += chunkFrames) {
            if (audioError) throw audioError
            const count = Math.min(chunkFrames, mixed.length - offset)
            const data = new Float32Array(count * 2)
            data.set(left.subarray(offset, offset + count), 0)
            data.set(right.subarray(offset, offset + count), count)
            const audioData = new AudioData({
              format: 'f32-planar',
              sampleRate: 48000,
              numberOfFrames: count,
              numberOfChannels: 2,
              timestamp: Math.round((offset / 48000) * 1000000),
              data,
            })
            audioEncoder.encode(audioData)
            audioData.close()
            if (audioEncoder.encodeQueueSize > 16) await new Promise(resolve => setTimeout(resolve, 5))
          }
          await audioEncoder.flush()
        } finally {
          try { audioEncoder.close() } catch { /* ignore */ }
        }
        if (audioError) throw audioError
      }

      setState({ progress: { stage: L('正在封装…', 'Muxing…'), ratio: 0.95 } })
      muxer.finalize()
      const extension = videoCodec.container === 'mp4' ? 'mp4' : 'webm'
      return {
        blob: new Blob([target.buffer], { type: extension === 'mp4' ? 'video/mp4' : 'video/webm' }),
        name: '录屏-' + stamp() + '.' + extension,
        format: extension,
        fallback,
      }
    }

    // -------------------------------------------------------------- attach
    function findComposerFileInput() {
      const areas = Array.prototype.slice.call(document.querySelectorAll('textarea, [contenteditable="true"]'))
        .filter(element => {
          const rect = element.getBoundingClientRect()
          return rect.width > 80 && rect.height > 12
        })
        .sort((a, b) => {
          const ra = a.getBoundingClientRect()
          const rb = b.getBoundingClientRect()
          return rb.width * rb.height - ra.width * ra.height
        })
      const roots = []
      let box = areas[0] || null
      for (let depth = 0; depth < 10 && box; depth++) {
        roots.push(box)
        box = box.parentElement
      }
      roots.push(document)
      for (const root of roots) {
        const inputs = Array.prototype.slice.call(root.querySelectorAll('input[type="file"]'))
          .filter(input => !input.disabled)
        if (inputs.length > 0) return inputs[inputs.length - 1]
      }
      return null
    }

    function attachFile(file) {
      const input = findComposerFileInput()
      if (input === null) return false
      try {
        const transfer = new DataTransfer()
        transfer.items.add(file)
        input.files = transfer.files
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      } catch {
        return false
      }
    }

    function downloadBlob(blob, name) {
      try {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = name
        document.body.appendChild(link)
        link.click()
        link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 10000)
      } catch { /* ignore */ }
    }

    async function reveal(pathValue) {
      try {
        await fetch(PREFIX + '/reveal?path=' + encodeURIComponent(pathValue), { cache: 'no-store' })
      } catch { /* ignore */ }
    }

    /**
     * 截图收尾：存盘 + 放进剪贴板，不再自动挂到输入框。
     *
     * 自动挂附件会把用户"截个图去别处用"的流程打断（还得手动删掉附件），
     * 而复制到剪贴板是所有场景都通用的下一步。
     */
    async function saveScreenshot(blob, name) {
      let saved = null
      let copied = false
      try { saved = await uploadBlob(blob, name, 'image') } catch { /* 保存失败时仍尝试剪贴板 */ }
      try {
        await putClipboard('image', { blob })
        copied = true
      } catch { /* 剪贴板被占用时不影响存盘 */ }
      const parts = []
      if (saved) parts.push(L('已保存', 'Saved'))
      if (copied) parts.push(L('已复制到剪贴板', 'Copied to the clipboard'))
      if (parts.length === 0) {
        toast(L('截图没能保存', 'Screenshot not saved'), { kind: 'error' })
        return
      }
      toast(parts.join(' · '), { kind: 'success', path: saved ? saved.file : '', dir: saved ? saved.dir : '' })
    }

    // ------------------------------------------------------------- settings
    function formatBytes(bytes) {
      if (!Number.isFinite(bytes)) return ''
      if (bytes < 1024) return bytes + ' B'
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
      if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
      return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
    }

    function formatDate(ms) {
      try { return new Date(ms).toLocaleString() } catch { return '' }
    }

    function keyName(event) {
      const key = event.key
      if (key === ' ' || key === 'Spacebar') return 'Space'
      if (key.length === 1) return key.toUpperCase()
      return key
    }

    function comboFromEvent(event) {
      const parts = []
      if (event.ctrlKey) parts.push('Ctrl')
      if (event.altKey) parts.push('Alt')
      if (event.shiftKey) parts.push('Shift')
      if (event.metaKey) parts.push('Meta')
      const key = keyName(event)
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) parts.push(key)
      return parts.join('+')
    }

    function matchesShortcut(event, combo) {
      if (!combo) return false
      return comboFromEvent(event) === combo
    }

    /**
     * 焦点是否在「会吃掉普通按键」的文本输入区。
     *
     * 只有多行输入框、文本域和可编辑区真的需要独占字母键；单行 input、
     * select 不拦——用户的截图快捷键带修饰键，不会和打字冲突。
     */
    function isTypingTarget(target) {
      if (!target || typeof target.closest !== 'function') return false
      if (target.closest('textarea,[contenteditable="true"],[contenteditable=""]')) return true
      const input = target.closest('input')
      if (!input) return false
      const type = String(input.type || 'text').toLowerCase()
      // 这些类型收字母，其余（checkbox/radio/button/range/color/date…）不收。
      return ['text', 'search', 'url', 'tel', 'email', 'password', 'number'].includes(type)
    }

    /**
     * 事件本身是不是一个带修饰键的快捷键组合。
     *
     * 带 Ctrl/Alt/Meta 的组合键在输入框里同样是命令，不该被当成打字；
     * 只有裸字母（不带修饰键）才让给输入区。
     */
    function isShortcutCombo(event) {
      return Boolean(event && (event.ctrlKey || event.altKey || event.metaKey))
    }

    function ShortcutInput(props) {
      const [capturing, setCapturing] = useState(false)
      return h('input', {
        className: 'vsr-input vsr-shortcut-input',
        value: capturing ? L('按下快捷键…', 'Press a shortcut…') : props.value,
        readOnly: true,
        onFocus: () => setCapturing(true),
        onBlur: () => setCapturing(false),
        onKeyDown: event => {
          event.preventDefault()
          event.stopPropagation()
          if (event.key === 'Escape') { setCapturing(false); event.currentTarget.blur(); return }
          const key = keyName(event)
          if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return
          const combo = comboFromEvent(event)
          if (!combo) return
          props.onChange(combo)
          setCapturing(false)
          event.currentTarget.blur()
        },
      })
    }

    function SettingsIcon() {
      return h('svg', { viewBox: '0 0 16 16', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.25, 'aria-hidden': 'true' },
        h('rect', { x: 2, y: 3, width: 12, height: 8.5, rx: 1.5 }),
        h('circle', { cx: 8, cy: 7.25, r: 1.7, fill: 'currentColor', stroke: 'none' }),
        h('path', { d: 'M6 14h4' }))
    }

    function SettingsPage() {
      const [draft, setDraft] = useState(DEFAULT_SETTINGS)
      const [paths, setPaths] = useState(null)
      const [library, setLibrary] = useState([])
      const [loading, setLoading] = useState(true)
      const [saving, setSaving] = useState(false)
      const [filter, setFilter] = useState('all')
      const [converting, setConverting] = useState(null)
      const [convertProgress, setConvertProgress] = useState(0)
      const [error, setError] = useState('')
      // OCR 引擎列表：来自 dsh-tool-ocr 的配置 + 系统自带 Windows OCR。
      const [ocrInfo, setOcrInfo] = useState({ engines: [], languages: [], winrt: false, active: '' })

      async function refreshOcr() {
        try {
          setOcrInfo(await apiJson('/ocr/status'))
        } catch { /* 宿主老版本没有这条路由时保持空列表 */ }
      }

      async function refreshLibrary() {
        // 文件列表失败绝不能连累设置页：设置卡片是用户唯一能改配置的入口，
        // 不能因为读不到截图目录就整页空白。
        try {
          const data = await apiJson('/library')
          setLibrary(data.files || [])
        } catch {
          setLibrary([])
        }
      }

      async function load() {
        setLoading(true)
        setError('')
        try {
          const data = await apiJson('/settings')
          const settings = data.settings || DEFAULT_SETTINGS
          setDraft({
            ...DEFAULT_SETTINGS,
            ...settings,
            shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(settings.shortcuts || {}) },
          })
          setPaths(data.paths || null)
          setState({ settings, paths: data.paths || null })
          // 这两项各自吞掉错误，且不再阻塞 loading——设置卡片一拿到就能出。
          await Promise.all([refreshLibrary(), refreshOcr()])
        } catch (failure) {
          setError(friendly(failure))
        } finally {
          setLoading(false)
        }
      }

      useEffect(() => { void load() }, [])

      async function save() {
        setSaving(true)
        try {
          const data = await apiJson('/settings', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(draft),
          })
          setDraft({ ...DEFAULT_SETTINGS, ...data.settings, shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(data.settings.shortcuts || {}) } })
          setPaths(data.paths || null)
          setState({ settings: data.settings, paths: data.paths || null })
          await Promise.all([refreshLibrary(), refreshOcr()])
          toast(L('设置已保存', 'Settings saved'), { kind: 'success' })
        } catch (failure) {
          toast(L('保存失败：', 'Save failed: ') + friendly(failure), { kind: 'error' })
        } finally {
          setSaving(false)
        }
      }

      async function pickDir(fieldName) {
        const picker = window.__DSH_DIRECTORY_PICKER__
        if (!picker || typeof picker.pick !== 'function') {
          toast(L('当前环境不支持文件夹选择，请手动输入路径', 'Folder picker unavailable; type the path'), { kind: 'error' })
          return
        }
        try {
          const dir = await picker.pick()
          if (dir) setDraft(current => ({ ...current, [fieldName]: dir }))
        } catch { /* 用户取消 */ }
      }

      function openPath(target) {
        if (target) void reveal(target)
        else toast(L('先保存设置，宿主才能确定目录', 'Save settings first'), { kind: 'error' })
      }

      /** 文件卡片的「打开文件夹」跟随当前筛选：全部 → 根目录，录屏/截图 → 各自目录。 */
      function openLibraryFolder() {
        const target = filter === 'video' ? paths && paths.recordings
          : filter === 'image' ? paths && paths.screenshots
            : paths && (paths.root || paths.recordings)
        openPath(target || null)
      }

      async function removeFile(file) {
        if (typeof window.confirm === 'function' && !window.confirm(L('删除这个文件？\n', 'Delete this file?\n') + file.name)) return
        try {
          await apiJson('/library/delete', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ kind: file.kind, name: file.name }),
          })
          await refreshLibrary()
          toast(L('已删除', 'Deleted'), { kind: 'success' })
        } catch (failure) {
          toast(L('删除失败：', 'Delete failed: ') + friendly(failure), { kind: 'error' })
        }
      }

      async function convert(file) {
        if (converting !== null) return
        const mime = 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'
        if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported(mime)) {
          toast(L('当前环境不支持 MP4 转换', 'MP4 conversion unavailable'), { kind: 'error' })
          return
        }
        setConverting(file.name)
        setConvertProgress(0)
        const video = document.createElement('video')
        video.src = PREFIX + '/record/serve?kind=video&name=' + encodeURIComponent(file.name)
        video.preload = 'auto'
        video.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none'
        document.body.appendChild(video)
        try {
          await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve
            video.onerror = () => reject(new Error(L('加载视频失败', 'Failed to load video')))
          })
          const stream = typeof video.captureStream === 'function' ? video.captureStream() : null
          if (!stream) throw new Error(L('浏览器不支持 captureStream', 'captureStream unavailable'))
          const recorder = new MediaRecorder(stream, {
            mimeType: mime,
            videoBitsPerSecond: Math.min(8000000, Math.max(2000000, Math.round((video.videoWidth || 1280) * (video.videoHeight || 720) * 4))),
          })
          const chunks = []
          recorder.ondataavailable = event => { if (event.data && event.data.size > 0) chunks.push(event.data) }
          const stopped = new Promise(resolve => { recorder.onstop = resolve })
          video.ontimeupdate = () => {
            if (video.duration) setConvertProgress(Math.min(1, video.currentTime / video.duration))
          }
          recorder.start(1000)
          await video.play()
          await new Promise(resolve => {
            video.onended = resolve
            setTimeout(resolve, Math.max(3000, ((video.duration || 0) + 2) * 1000))
          })
          recorder.stop()
          await stopped
          const blob = new Blob(chunks, { type: 'video/mp4' })
          const name = file.name.replace(/\.webm$/i, '') + '.mp4'
          await uploadBlob(blob, name, 'video')
          await refreshLibrary()
          toast(L('已转成 MP4：', 'Converted to MP4: ') + name, { kind: 'success' })
        } catch (failure) {
          toast(L('转换失败：', 'Conversion failed: ') + friendly(failure), { kind: 'error' })
        } finally {
          video.remove()
          setConverting(null)
          setConvertProgress(0)
        }
      }

      // 设置页一出来就把滚动位置拉回顶部：面板的滚动容器是宿主的，
      // 用户上次滚到底部的「文件」时，下次进来会停在底部，看起来像前几张卡片没了。
      const topRef = useRef(null)
      useEffect(() => {
        if (loading) return
        const node = topRef.current
        if (!node) return
        // 只滚最近的滚动容器，不动整页。
        const scroller = typeof node.closest === 'function'
          ? node.closest('.vsr-settings') || node
          : node
        if (scroller && typeof scroller.scrollIntoView === 'function') {
          scroller.scrollIntoView({ block: 'start' })
        }
      }, [loading])

      const field = (label, control, note) => h('label', { className: 'vsr-field' },
        h('span', { className: 'vsr-field-label' }, label),
        control,
        note ? h('span', { className: 'vsr-field-note' }, note) : null)

      // 注意：这里不再因为 loading 就整页只显示"正在读取设置…"。
      // 之前那样写，任何一个接口（/library、/ocr/status）卡住或失败，用户就
      // 看不到任何设置卡片——截图目录、快捷键全都改不了。现在设置卡片始终
      // 用 draft 的当前值渲染，加载只是把占位换成真实值。
      const files = library.filter(file => filter === 'all' || file.kind === filter)
      return h('div', { className: 'vsr-settings', ref: topRef },
        h('div', { className: 'vsr-settings-head' },
          h('div', null,
            h('h2', null, L('录屏与截图', 'Screen recorder')),
            h('div', { className: 'vsr-muted' }, loading
              ? L('正在读取设置…', 'Loading settings…')
              : L('存储位置、录制格式、快捷键和文件都在这里管理。', 'Manage storage, format, shortcuts and files.'))),
          h('button', { type: 'button', className: 'vsr-settings-link', onClick: () => { void load() } }, L('刷新', 'Refresh'))),
        error ? h('div', { className: 'vsr-error' }, error) : null,
        h('section', { className: 'vsr-card' },
          h('h3', null, L('存储位置', 'Storage')),
          field(L('视频保存到', 'Save videos to'),
            h('div', { className: 'vsr-storage-row' },
              h('input', {
                className: 'vsr-input vsr-grow',
                value: draft.videoDir,
                placeholder: paths ? paths.recordings : L('默认：视频 / Vyra Screen Recorder / recordings', 'Default: Videos / Vyra Screen Recorder / recordings'),
                onChange: event => setDraft({ ...draft, videoDir: event.target.value }),
              }),
              h('button', { type: 'button', className: 'vsr-btn-outline', onClick: () => { void pickDir('videoDir') } }, L('选择…', 'Choose…')),
              h('button', { type: 'button', className: 'vsr-btn-outline', onClick: () => openPath(paths && paths.recordings) }, L('打开', 'Open')),
              h('button', { type: 'button', className: 'vsr-btn-outline', onClick: () => setDraft({ ...draft, videoDir: '' }) }, L('默认', 'Default')))),
          field(L('截图保存到', 'Save screenshots to'),
            h('div', { className: 'vsr-storage-row' },
              h('input', {
                className: 'vsr-input vsr-grow',
                value: draft.shotDir,
                placeholder: paths ? paths.screenshots : L('默认：视频 / Vyra Screen Recorder / screenshots', 'Default: Videos / Vyra Screen Recorder / screenshots'),
                onChange: event => setDraft({ ...draft, shotDir: event.target.value }),
              }),
              h('button', { type: 'button', className: 'vsr-btn-outline', onClick: () => { void pickDir('shotDir') } }, L('选择…', 'Choose…')),
              h('button', { type: 'button', className: 'vsr-btn-outline', onClick: () => openPath(paths && paths.screenshots) }, L('打开', 'Open')),
              h('button', { type: 'button', className: 'vsr-btn-outline', onClick: () => setDraft({ ...draft, shotDir: '' }) }, L('默认', 'Default')))),
          h('div', { className: 'vsr-muted vsr-path' }, L('留空使用默认位置；目录不存在时会自动创建。', 'Leave empty for the default; folders are created automatically.'))),
        h('section', { className: 'vsr-card' },
          h('h3', null, L('录制', 'Recording')),
          h('div', { className: 'vsr-grid' },
            field(L('保存格式', 'Save format'), h('select', {
              className: 'vsr-select',
              value: draft.format,
              onChange: event => setDraft({ ...draft, format: event.target.value }),
            },
            h('option', { value: 'mp4' }, L('MP4（H.264 / AAC）', 'MP4 (H.264 / AAC)')),
            h('option', { value: 'webm' }, 'WebM（VP9 / Opus）')), L('停止后自动存成 MP4；环境不支持时回退 WebM。', 'Saved as MP4 after recording; falls back to WebM if unsupported.')),
            field(L('帧率', 'Frame rate'), h('select', {
              className: 'vsr-select', value: String(draft.fps),
              onChange: event => setDraft({ ...draft, fps: Number(event.target.value) }),
            }, ...[5, 8, 10, 12].map(value => h('option', { key: value, value: String(value) }, value + ' fps')))),
            field(L('JPEG 质量', 'JPEG quality'), h('input', {
              className: 'vsr-input', type: 'number', min: 40, max: 90, value: draft.quality,
              onChange: event => setDraft({ ...draft, quality: Number(event.target.value) }),
            })),
            field(L('长边上限', 'Max edge'), h('select', {
              className: 'vsr-select', value: String(draft.maxEdge),
              onChange: event => setDraft({ ...draft, maxEdge: Number(event.target.value) }),
            }, ...[1280, 1920, 2560].map(value => h('option', { key: value, value: String(value) }, String(value))))),
            field(L('最长时长', 'Max duration'), h('select', {
              className: 'vsr-select', value: String(draft.maxSeconds),
              onChange: event => setDraft({ ...draft, maxSeconds: Number(event.target.value) }),
            }, ...[60, 180, 300, 600].map(value => h('option', { key: value, value: String(value) }, L(value / 60 + ' 分钟', value / 60 + ' min')))))),
          h('div', { className: 'vsr-checks' },
            h('label', { className: 'vsr-check' }, h('input', {
              type: 'checkbox', checked: draft.includeSystemAudio,
              onChange: event => setDraft({ ...draft, includeSystemAudio: event.target.checked }),
            }), L('默认录系统声音', 'System audio by default')),
            h('label', { className: 'vsr-check' }, h('input', {
              type: 'checkbox', checked: draft.includeMic,
              onChange: event => setDraft({ ...draft, includeMic: event.target.checked }),
            }), L('默认录麦克风', 'Microphone by default')))),
        h('section', { className: 'vsr-card' },
          h('h3', null, L('快捷键', 'Shortcuts')),
          h('div', { className: 'vsr-grid' },
            field(L('截图', 'Screenshot'), h(ShortcutInput, {
              value: draft.shortcuts.screenshot,
              onChange: value => setDraft({ ...draft, shortcuts: { ...draft.shortcuts, screenshot: value } }),
            })),
            field(L('录屏 / 停止', 'Record / stop'), h(ShortcutInput, {
              value: draft.shortcuts.record,
              onChange: value => setDraft({ ...draft, shortcuts: { ...draft.shortcuts, record: value } }),
            })),
            field(L('截图浮层 · 提取文字', 'Shot overlay · text'), h(ShortcutInput, {
              value: draft.shortcuts.text,
              onChange: value => setDraft({ ...draft, shortcuts: { ...draft.shortcuts, text: value } }),
            })),
            field(L('截图浮层 · 复制图片', 'Shot overlay · copy image'), h(ShortcutInput, {
              value: draft.shortcuts.copyImage,
              onChange: value => setDraft({ ...draft, shortcuts: { ...draft.shortcuts, copyImage: value } }),
            })),
            field(L('截图浮层 · 复制文件', 'Shot overlay · copy file'), h(ShortcutInput, {
              value: draft.shortcuts.clipboard,
              onChange: value => setDraft({ ...draft, shortcuts: { ...draft.shortcuts, clipboard: value } }),
            })),
            field(L('截图浮层 · 用这张', 'Shot overlay · use this'), h(ShortcutInput, {
              value: draft.shortcuts.save,
              onChange: value => setDraft({ ...draft, shortcuts: { ...draft.shortcuts, save: value } }),
            }))),
          h('div', { className: 'vsr-muted' }, L('在 DSH 窗口内生效；点输入框后直接按组合键。工具条按钮上悬停会显示对应快捷键。', 'Active while DSH is focused; hover a toolbar button to see its shortcut.'))),
        h('section', { className: 'vsr-card' },
          h('h3', null, L('文字识别', 'Text recognition')),
          h('div', { className: 'vsr-grid' },
            field(L('识别引擎', 'Engine'), h('select', {
              className: 'vsr-select',
              value: (draft.ocr && draft.ocr.engine) || 'auto',
              onChange: event => setDraft({ ...draft, ocr: { ...(draft.ocr || {}), engine: event.target.value } }),
            },
            h('option', { value: 'auto' }, L('自动（跟随 OCR 插件配置，没有则用系统 OCR）', 'Auto (OCR plugin config, else Windows OCR)')),
            ...ocrInfo.engines.map(engine => h('option', { key: engine.id, value: engine.id }, engine.label + ' · ' + engine.mode)))),
            field(L('语言', 'Language'), h('select', {
              className: 'vsr-select',
              value: (draft.ocr && draft.ocr.lang) || 'system',
              onChange: event => setDraft({ ...draft, ocr: { ...(draft.ocr || {}), lang: event.target.value } }),
            },
            h('option', { value: 'system' }, L('跟随系统', 'System default')),
            ...ocrInfo.languages.map(tag => h('option', { key: tag, value: tag }, tag))))),
          h('div', { className: 'vsr-muted' },
            ocrInfo.winrt
              ? L('系统 OCR 可用：', 'Windows OCR available: ') + ocrInfo.languages.join(', ') + L('。截图后点「文」取字。', '. Click the text button to read it.')
              : L('系统 OCR 不可用：请在「设置 → 时间和语言 → 语言和区域」里安装语言包。', 'Windows OCR unavailable: install a language pack under Settings → Time & language.')))),
        h('div', { className: 'vsr-settings-actions' },
          h('button', { type: 'button', className: 'vsr-btn-primary', disabled: saving, onClick: () => { void save() } },
            saving ? L('保存中…', 'Saving…') : L('保存设置', 'Save settings')),
          h('span', { className: 'vsr-muted' }, L('修改后点保存。', 'Save to apply.'))),
        h('section', { className: 'vsr-card' },
          h('div', { className: 'vsr-library-head' },
            h('h3', null, L('文件', 'Files')),
            h('div', { className: 'vsr-library-actions' },
              h('button', { type: 'button', className: 'vsr-filter' + (filter === 'all' ? ' vsr-filter-on' : ''), onClick: () => setFilter('all') }, L('全部', 'All')),
              h('button', { type: 'button', className: 'vsr-filter' + (filter === 'video' ? ' vsr-filter-on' : ''), onClick: () => setFilter('video') }, L('录屏', 'Videos')),
              h('button', { type: 'button', className: 'vsr-filter' + (filter === 'image' ? ' vsr-filter-on' : ''), onClick: () => setFilter('image') }, L('截图', 'Images')),
              h('button', { type: 'button', className: 'vsr-settings-link', onClick: () => { void refreshLibrary() } }, L('刷新', 'Refresh')),
              h('button', { type: 'button', className: 'vsr-settings-link', onClick: openLibraryFolder }, L('打开文件夹', 'Open folder'))),
          converting !== null ? h('div', { className: 'vsr-convert' },
            h('div', { className: 'vsr-muted' }, L('正在转 MP4：', 'Converting to MP4: ') + converting + '（会实时播放原音频）'),
            h('div', { className: 'vsr-bar' }, h('div', { className: 'vsr-bar-fill', style: { width: Math.round(convertProgress * 100) + '%' } }))) : null,
          files.length === 0
            ? h('div', { className: 'vsr-empty' }, L('这里还没有文件。', 'No files yet.'))
            : h('div', { className: 'vsr-file-list' }, ...files.map(file => h('div', { className: 'vsr-file-row', key: file.path },
              h('span', { className: 'vsr-file-kind' + (file.kind === 'image' ? ' vsr-file-kind-image' : '') }, file.kind === 'image' ? L('截图', 'Image') : L('录屏', 'Video')),
              h('span', { className: 'vsr-file-name', title: file.path }, file.name),
              h('span', { className: 'vsr-file-meta' }, formatBytes(file.size) + ' · ' + formatDate(file.mtime)),
              h('button', { type: 'button', className: 'vsr-settings-link', onClick: () => { void reveal(file.path) } }, L('打开', 'Open')),
              file.kind === 'video' && file.name.toLowerCase().endsWith('.webm')
                ? h('button', { type: 'button', className: 'vsr-settings-link', disabled: converting !== null, onClick: () => { void convert(file) } }, L('转 MP4', 'To MP4'))
                : null,
              h('button', { type: 'button', className: 'vsr-settings-link vsr-danger', onClick: () => { void removeFile(file) } }, L('删除', 'Delete')))))))
    }

    // ---------------------------------------------------------------- icons
    const iconRecord = () => h('svg', { viewBox: '0 0 16 16', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.25, 'aria-hidden': 'true' },
      h('rect', { x: 2, y: 3, width: 12, height: 8.5, rx: 1.5 }),
      h('circle', { cx: 8, cy: 7.25, r: 1.7, fill: 'currentColor', stroke: 'none' }),
      h('path', { d: 'M6 14h4' }))
    const iconCamera = () => h('svg', { viewBox: '0 0 16 16', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.25, 'aria-hidden': 'true' },
      h('path', { d: 'M2.5 5.5h2l1-1.5h5l1 1.5h2v7h-11z' }),
      h('circle', { cx: 8, cy: 9, r: 2.2 }))
    const iconStop = () => h('svg', { viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': 'true' },
      h('rect', { x: 4, y: 4, width: 8, height: 8, rx: 2, fill: 'currentColor' }))
    const iconChevron = open => h('span', { className: 'vsr-chevron', 'aria-hidden': 'true' }, open ? '▾' : '▸')

    // -------------------------------------------------------------- toolbar
    function Toolbar(props) {
      const snapshot = useStore()
      const now = useNow(snapshot.phase === 'recording')
      const recording = snapshot.recording
      const seconds = recording ? Math.max(0, Math.floor((now - recording.startedAt) / 1000)) : 0
      const busy = snapshot.phase === 'starting' || snapshot.phase === 'encoding' || Boolean(snapshot.agentRecording)
      const isRecording = snapshot.phase === 'recording'
      const settings = snapshot.settings || DEFAULT_SETTINGS
      const shortcuts = settings.shortcuts || DEFAULT_SETTINGS.shortcuts
      const agentLabel = L('Agent 正在录屏', 'Agent is recording')
      const recordLabel = snapshot.agentRecording ? agentLabel : (isRecording ? S.stopTip : S.recordTip)
      const recordShortcut = snapshot.agentRecording ? '' : shortcuts.record
      // 可见文字（"录屏"）和悬停提示分开：屏幕阅读器和原生 title 都读可见文字。
      return h('div', { className: 'vsr-toolbar' },
        h('div', { className: 'vsr-btn-wrap' },
          h('button', {
            type: 'button',
            className: 'vsr-btn' + (isRecording ? ' vsr-btn-rec' : ''),
            disabled: busy,
            // 原生 title 一直保留：自绘提示被样式挡住时，用户仍能看到系统提示。
            title: recordLabel + (recordShortcut ? ' (' + formatCombo(recordShortcut) + ')' : ''),
            'aria-label': recordLabel,
            onMouseDown: event => event.preventDefault(),
            onClick: () => { if (isRecording) void stopRecording(); else void openPicker() },
          }, isRecording
            ? h('span', { className: 'vsr-rec-pill' }, h('span', { className: 'vsr-dot' }), formatDuration(seconds), iconStop())
            : iconRecord()),
          h(Tip, { label: recordLabel, shortcut: recordShortcut })),
        h('div', { className: 'vsr-btn-wrap' },
          h('button', {
            type: 'button',
            className: 'vsr-btn',
            disabled: busy || isRecording,
            title: S.shotTip + ' (' + formatCombo(shortcuts.screenshot) + ')',
            'aria-label': S.shotTip,
            onMouseDown: event => event.preventDefault(),
            onClick: () => { void takeScreenshot() },
          }, iconCamera()),
          h(Tip, { label: S.shotTip, shortcut: shortcuts.screenshot })),
      )
    }

    // --------------------------------------------------------------- picker
    function useImage(url) {
      const [image, setImage] = useState(null)
      useEffect(() => {
        if (!url) { setImage(null); return undefined }
        let alive = true
        const element = new Image()
        element.onload = () => { if (alive) setImage(element) }
        element.src = url
        return () => { alive = false; element.onload = null }
      }, [url])
      return image
    }

    function Thumb(props) {
      const { image, virtual, rect } = props
      const ref = useRef(null)
      useEffect(() => {
        const canvas = ref.current
        if (!canvas || !image || !virtual || !rect) return
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = 'rgba(0,0,0,.35)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        const kx = image.naturalWidth / virtual.w
        const ky = image.naturalHeight / virtual.h
        const sx = Math.max(0, (rect.x - virtual.x) * kx)
        const sy = Math.max(0, (rect.y - virtual.y) * ky)
        const sw = Math.max(1, Math.min(image.naturalWidth - sx, rect.w * kx))
        const sh = Math.max(1, Math.min(image.naturalHeight - sy, rect.h * ky))
        const scale = Math.min(canvas.width / sw, canvas.height / sh)
        const dw = sw * scale
        const dh = sh * scale
        ctx.drawImage(image, sx, sy, sw, sh, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh)
      }, [image, virtual, rect])
      return h('canvas', { ref, className: 'vsr-thumb', width: 72, height: 44 })
    }

    function Picker(props) {
      const { picker } = props
      const [windowsOpen, setWindowsOpen] = useState(false)
      const storeSnapshot = useStore()
      const defaults = storeSnapshot.settings || DEFAULT_SETTINGS
      const [systemAudio, setSystemAudio] = useState(defaults.includeSystemAudio !== false)
      const [microphone, setMicrophone] = useState(defaults.includeMic !== false)
      const image = useImage(picker.shotUrl)
      const lastKey = useMemo(() => {
        try { return sourceKey(JSON.parse(localStorage.getItem('vsr.lastSource') || 'null')) } catch { return '' }
      }, [])
      const lastRef = useRef(null)
      useEffect(() => {
        if (lastRef.current && typeof lastRef.current.scrollIntoView === 'function') {
          lastRef.current.scrollIntoView({ block: 'nearest' })
        }
      }, [image, windowsOpen])

      const virtual = picker.sources.virtual
      const options = { includeSystemAudio: systemAudio, includeMic: microphone }
      // 截图模式：选中的源决定截图浮层里能框多大范围。选完不直接开录，
      // 而是带着这个源的虚拟坐标进浮层，让用户继续拖框。
      const isShot = picker.mode === 'shot'
      const chooseSource = (choice, thumbnailRect) => {
        if (isShot) {
          openShotOverlay(picker, choice, thumbnailRect, options)
          return
        }
        void startRecording(choice, options)
      }
      const row = (key, choice, name, detail, thumbnailRect) => {
        const selected = key === lastKey
        return h('button', {
          key: key,
          ref: selected ? lastRef : null,
          type: 'button',
          className: 'vsr-row' + (selected ? ' vsr-row-last' : ''),
          onClick: () => chooseSource(choice, thumbnailRect),
        },
        h(Thumb, { image, virtual, rect: thumbnailRect }),
        h('span', { className: 'vsr-row-text' },
          h('span', { className: 'vsr-row-name' }, name),
          h('span', { className: 'vsr-row-detail' }, detail)))
      }

      const desktopChoice = { type: 'desktop' }
      return h('div', { className: 'vsr-overlay', onMouseDown: event => { if (event.target === event.currentTarget) closePicker() } },
        h('div', { className: 'vsr-modal' },
          h('div', { className: 'vsr-modal-head' },
            h('strong', null, isShot ? S.shotPickerTitle : S.pickerTitle),
            h('button', { type: 'button', className: 'vsr-x', onClick: closePicker, 'aria-label': S.close }, '×')),
          h('div', { className: 'vsr-scroll' },
            row('desktop', desktopChoice, S.desktop, virtual.w + ' × ' + virtual.h, { x: virtual.x, y: virtual.y, w: virtual.w, h: virtual.h }),
            picker.sources.monitors.length > 0 ? h('div', { className: 'vsr-section' }, S.monitors) : null,
            ...picker.sources.monitors.map(monitor => row(
              'monitor:' + (monitor.name || monitor.x + ',' + monitor.y),
              { type: 'monitor', x: monitor.x, y: monitor.y, w: monitor.w, h: monitor.h, name: monitor.name },
              S.monitors + ' ' + monitor.index + (monitor.primary ? ' · ' + S.primary : ''),
              monitor.w + ' × ' + monitor.h,
              { x: monitor.x, y: monitor.y, w: monitor.w, h: monitor.h },
            )),
            picker.sources.windows.length > 0
              ? h('button', { type: 'button', className: 'vsr-section vsr-section-toggle', onClick: () => setWindowsOpen(open => !open) },
                iconChevron(windowsOpen), ' ' + S.windows + '（' + picker.sources.windows.length + '）')
              : null,
            windowsOpen ? picker.sources.windows.map(win => row(
              'window:' + win.hwnd,
              { type: 'window', hwnd: win.hwnd, title: win.title },
              win.title,
              (win.process ? win.process + ' · ' : '') + win.w + ' × ' + win.h,
              win,
            )) : null,
            h('button', {
              type: 'button',
              className: 'vsr-row vsr-row-custom',
              onClick: () => openRegionShot(picker, options),
            },
            h('span', { className: 'vsr-custom-icon' }, '⌗'),
            h('span', { className: 'vsr-row-text' },
              h('span', { className: 'vsr-row-name' }, S.custom),
              h('span', { className: 'vsr-row-detail' }, isShot ? S.customHintShot : S.customHint)))),
          h('div', { className: 'vsr-modal-foot vsr-picker-foot' },
            // 截图不需要音频开关，隐藏它们，只留提示。
            isShot
              ? h('span', { className: 'vsr-hint vsr-hint-wide' }, S.shotPickerHint)
              : h(React.Fragment, null,
                h('label', { className: 'vsr-check' }, h('input', { type: 'checkbox', checked: systemAudio, onChange: event => setSystemAudio(event.target.checked) }), S.systemAudio),
                h('label', { className: 'vsr-check' }, h('input', { type: 'checkbox', checked: microphone, onChange: event => setMicrophone(event.target.checked) }), S.microphone),
                h('span', { className: 'vsr-hint' }, defaults.fps + ' fps · ' + Math.round(defaults.maxSeconds / 60) + L(' 分钟 · 窗口录制会录到遮挡物', ' min · window capture includes occluders'))))))
    }

    // ------------------------------------------------------------ screenshot
    function ScreenshotOverlay(props) {
      const { shot } = props
      const isRegion = shot.mode === 'region'
      const [viewport, setViewport] = useState(0)
      const [phase, setPhase] = useState('select')
      const [sel, setSel] = useState(null)
      const [tool, setTool] = useState('pen')
      const [color, setColor] = useState('#e5484d')
      const [lineWidth, setLineWidth] = useState(3)
      const [strokes, setStrokes] = useState([])
      const [draft, setDraft] = useState(null)
      const [textInput, setTextInput] = useState(null)
      const [imageUrl, setImageUrl] = useState(shot.url)
      // 取字与复制：和 QQ / 微信截图一样，在标注工具条上一键取字、一键复制。
      const [extract, setExtract] = useState(null) // { status: 'loading'|'ready'|'error', text, lines, engine, error }
      const [panelOpen, setPanelOpen] = useState(true)
      const [copying, setCopying] = useState(null) // 'image' | 'file' | 'text'
      const [cursorPos, setCursorPos] = useState(null)
      const extractRef = useRef(null)
      const selAtExtract = useRef('')
      const generatedUrls = useRef([])
      const wrapRef = useRef(null)
      const canvasRef = useRef(null)
      const dragRef = useRef(null)
      const selRef = useRef(null)
      const draftRef = useRef(null)
      const imageW = shot.imageW
      const imageH = shot.imageH
      // 选源后截图：只在所选源的矩形里拖框。crop 是底图上的裁剪区
      // （虚拟桌面坐标），换算成显示坐标后作为拖框的边界与初始全局选区。
      const crop = useMemo(() => {
        const box = shot.crop
        if (!box || !shot.virtual) return null
        const kx = imageW / shot.virtual.w
        const ky = imageH / shot.virtual.h
        return {
          x: (box.x - shot.virtual.x) * kx,
          y: (box.y - shot.virtual.y) * ky,
          w: Math.max(1, box.w * kx),
          h: Math.max(1, box.h * ky),
        }
      }, [shot.crop, shot.virtual, imageW, imageH])

      const disp = useMemo(() => {
        const maxW = Math.max(200, window.innerWidth * 0.92)
        const maxH = Math.max(160, window.innerHeight * 0.76)
        // 有裁剪区时按裁剪区缩放，浮层只展示所选源那一块。
        const boxW = crop ? crop.w : imageW
        const boxH = crop ? crop.h : imageH
        const scale = Math.min(maxW / boxW, maxH / boxH, 1)
        return { w: Math.max(1, Math.round(imageW * scale)), h: Math.max(1, Math.round(imageH * scale)) }
      }, [imageW, imageH, viewport, crop])
      // 浮层显示区（相对裁剪区左上角的偏移），没有 crop 时就是整张图。
      const viewBox = crop
        ? { x: crop.x * (disp.w / imageW), y: crop.y * (disp.h / imageH), w: crop.w * (disp.w / imageW), h: crop.h * (disp.h / imageH) }
        : { x: 0, y: 0, w: disp.w, h: disp.h }
      const toOrig = point => ({ x: point.x * imageW / disp.w, y: point.y * imageH / disp.h })
      const toDisp = point => ({ x: point.x * disp.w / imageW, y: point.y * disp.h / imageH })

      /** 把拖框点限制在 viewBox 内（选源截图时只在那一块里选）。 */
      const clampToView = point => ({
        x: Math.min(viewBox.x + viewBox.w, Math.max(viewBox.x, point.x)),
        y: Math.min(viewBox.y + viewBox.h, Math.max(viewBox.y, point.y)),
      })

      useEffect(() => {
        const onResize = () => setViewport(value => value + 1)
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
      }, [])
      useEffect(() => {
        setImageUrl(shot.url)
      }, [shot.url])
      useEffect(() => () => {
        for (const url of generatedUrls.current) { try { URL.revokeObjectURL(url) } catch { /* ignore */ } }
      }, [])
      useEffect(() => {
        const old = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = old }
      }, [])

      function drawStroke(ctx, stroke) {
        if (!stroke || !stroke.points || stroke.points.length === 0) return
        ctx.strokeStyle = stroke.color
        ctx.fillStyle = stroke.color
        ctx.lineWidth = stroke.width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        const points = stroke.points.map(toDisp)
        if (stroke.type === 'pen') {
          ctx.beginPath()
          ctx.moveTo(points[0].x, points[0].y)
          for (let index = 1; index < points.length; index++) ctx.lineTo(points[index].x, points[index].y)
          ctx.stroke()
        } else if (stroke.type === 'rect') {
          const start = points[0]
          const end = points[points.length - 1]
          ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y)
        } else if (stroke.type === 'arrow') {
          const start = points[0]
          const end = points[points.length - 1]
          ctx.beginPath()
          ctx.moveTo(start.x, start.y)
          ctx.lineTo(end.x, end.y)
          ctx.stroke()
          const angle = Math.atan2(end.y - start.y, end.x - start.x)
          const size = Math.max(9, stroke.width * 3.2)
          ctx.beginPath()
          ctx.moveTo(end.x, end.y)
          ctx.lineTo(end.x - size * Math.cos(angle - Math.PI / 7), end.y - size * Math.sin(angle - Math.PI / 7))
          ctx.moveTo(end.x, end.y)
          ctx.lineTo(end.x - size * Math.cos(angle + Math.PI / 7), end.y - size * Math.sin(angle + Math.PI / 7))
          ctx.stroke()
        } else if (stroke.type === 'text') {
          ctx.font = '600 ' + Math.max(14, stroke.size) + 'px -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif'
          ctx.textBaseline = 'top'
          ctx.fillText(stroke.text, points[0].x, points[0].y)
        }
      }

      useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ratio = window.devicePixelRatio || 1
        canvas.width = Math.round(disp.w * ratio)
        canvas.height = Math.round(disp.h * ratio)
        canvas.style.width = disp.w + 'px'
        canvas.style.height = disp.h + 'px'
        const ctx = canvas.getContext('2d')
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        ctx.clearRect(0, 0, disp.w, disp.h)
        // 先压暗整张图，再把选区抠亮——选区和外面一眼就能分开。
        // 必须画在最底层：先铺遮罩再画标注，否则标注会被遮罩压暗。
        if (sel && !isRegion) {
          ctx.save()
          ctx.fillStyle = 'rgba(0,0,0,.45)'
          ctx.fillRect(0, 0, disp.w, disp.h)
          ctx.clearRect(sel.x, sel.y, sel.w, sel.h)
          ctx.restore()
        }
        if (sel && (phase === 'annotate' || isRegion)) {
          ctx.save()
          ctx.beginPath()
          ctx.rect(sel.x, sel.y, sel.w, sel.h)
          ctx.clip()
          for (const stroke of strokes) drawStroke(ctx, stroke)
          if (draft) drawStroke(ctx, draft)
          ctx.restore()
        }
        // 选区的边框：选区阶段用虚线，确定后换成实线（表示已经可以编辑）。
        if (sel && !isRegion) {
          ctx.save()
          ctx.strokeStyle = phase === 'select' ? 'rgba(255,255,255,.95)' : 'rgba(74,163,255,.95)'
          ctx.lineWidth = 1
          if (phase === 'select') ctx.setLineDash([5, 4])
          ctx.strokeRect(sel.x + 0.5, sel.y + 0.5, sel.w, sel.h)
          ctx.setLineDash([])
          ctx.restore()
        }
        // 取字结果的行框：半透明蓝底 + 细边，和 QQ / 微信截图取字后的选区一致。
        // 坐标来自原图，按当前显示比例缩放。
        if (phase === 'annotate' && !isRegion && extract && extract.status === 'ready' && extract.lines.length > 0) {
          const kx = disp.w / imageW
          const ky = disp.h / imageH
          for (const line of extract.lines) {
            if (!line || !Number.isFinite(line.x) || !Number.isFinite(line.y)) continue
            const x = line.x * kx
            const y = line.y * ky
            const w = Math.max(1, (line.w || 0) * kx)
            const h = Math.max(1, (line.h || 0) * ky)
            if (sel && (x + w < sel.x || y + h < sel.y || x > sel.x + sel.w || y > sel.y + sel.h)) continue
            ctx.fillStyle = 'rgba(22,119,255,.16)'
            ctx.fillRect(x, y, w, h)
            ctx.strokeStyle = 'rgba(74,163,255,.9)'
            ctx.lineWidth = 1
            ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, w - 1), Math.max(1, h - 1))
          }
        }
      }, [sel, strokes, draft, disp, phase, tool, color, lineWidth, viewport, extract])

      function localPoint(event) {
        const rect = wrapRef.current.getBoundingClientRect()
        return { x: event.clientX - rect.left, y: event.clientY - rect.top }
      }
      function onDown(event) {
        if (event.button !== 0 || textInput) return
        const point = localPoint(event)
        if (phase === 'select') {
          // 选源截图时，落点必须在所选源的范围里，否则忽略这一下。
          if (crop && (point.x < viewBox.x || point.y < viewBox.y
            || point.x > viewBox.x + viewBox.w || point.y > viewBox.y + viewBox.h)) return
          dragRef.current = { start: point }
          const next = { x: point.x, y: point.y, w: 0, h: 0 }
          selRef.current = next
          setSel(next)
          return
        }
        if (isRegion) return
        event.preventDefault()
        if (tool === 'text') {
          setTextInput({ x: point.x, y: point.y, value: '' })
          return
        }
        const origin = toOrig(point)
        const next = { type: tool, color, width: lineWidth, size: Math.max(16, lineWidth * 6), points: [origin] }
        dragRef.current = { start: point }
        draftRef.current = next
        setDraft(next)
      }
      function onMove(event) {
        const drag = dragRef.current
        if (!drag) return
        const point = clampToView(localPoint(event))
        if (phase === 'select') {
          const x = Math.min(drag.start.x, point.x)
          const y = Math.min(drag.start.y, point.y)
          const next = { x, y, w: Math.abs(point.x - drag.start.x), h: Math.abs(point.y - drag.start.y) }
          selRef.current = next
          setSel(next)
          return
        }
        const current = draftRef.current
        if (!current) return
        const origin = toOrig(point)
        const next = current.type === 'pen'
          ? { ...current, points: [...current.points, origin] }
          : { ...current, points: [current.points[0], origin] }
        draftRef.current = next
        setDraft(next)
      }
      function onUp() {
        const drag = dragRef.current
        dragRef.current = null
        if (!drag) return
        if (phase === 'select') {
          const current = selRef.current
          if (!current || current.w < 8 || current.h < 8) {
            // 单击（没拖出框）：选中所选源的全部范围，而不是整个屏幕。
            const full = { x: viewBox.x, y: viewBox.y, w: viewBox.w, h: viewBox.h }
            selRef.current = full
            setSel(full)
          }
          if (!isRegion) setPhase('annotate')
          return
        }
        const current = draftRef.current
        if (current) {
          setStrokes(all => [...all, current])
          draftRef.current = null
          setDraft(null)
        }
      }
      function commitText() {
        if (!textInput) return
        const value = textInput.value.trim()
        if (value) {
          const origin = toOrig(textInput)
          setStrokes(current => [...current, {
            type: 'text', color, width: lineWidth, size: Math.max(16, lineWidth * 6),
            text: value, points: [origin],
          }])
        }
        setTextInput(null)
      }

      /**
       * 把当前选区（含标注）合成成一张原分辨率的 canvas。
       *
       * 不加标注时直接切原图像素：没有重编码，取字和复制图片都最清晰。
       * 有标注时才把标注按原图比例画上去。
       */
      function renderRegion() {
        return new Promise((resolve, reject) => {
          if (!sel) { reject(new Error(L('还没有选区', 'No selection yet'))); return }
          const image = new Image()
          image.onerror = () => reject(new Error(L('图片加载失败', 'Image failed to load')))
          image.onload = () => {
            const scaleX = imageW / disp.w
            const scaleY = imageH / disp.h
            const sx = sel.x * scaleX
            const sy = sel.y * scaleY
            const sw = Math.max(1, sel.w * scaleX)
            const sh = Math.max(1, sel.h * scaleY)
            const canvas = document.createElement('canvas')
            canvas.width = Math.max(1, Math.round(sw))
            canvas.height = Math.max(1, Math.round(sh))
            const ctx = canvas.getContext('2d')
            ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
            if (strokes.length > 0) {
              ctx.save()
              ctx.translate(-sx, -sy)
              const scaled = strokes.map(stroke => ({ ...stroke, width: stroke.width * scaleX, size: (stroke.size || 0) * scaleX }))
              for (const stroke of scaled) {
                const points = stroke.points
                ctx.strokeStyle = stroke.color
                ctx.fillStyle = stroke.color
                ctx.lineWidth = stroke.width
                ctx.lineCap = 'round'
                ctx.lineJoin = 'round'
                if (stroke.type === 'pen') {
                  ctx.beginPath()
                  ctx.moveTo(points[0].x, points[0].y)
                  for (let index = 1; index < points.length; index++) ctx.lineTo(points[index].x, points[index].y)
                  ctx.stroke()
                } else if (stroke.type === 'rect') {
                  const start = points[0]
                  const end = points[points.length - 1]
                  ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y)
                } else if (stroke.type === 'arrow') {
                  const start = points[0]
                  const end = points[points.length - 1]
                  ctx.beginPath()
                  ctx.moveTo(start.x, start.y)
                  ctx.lineTo(end.x, end.y)
                  ctx.stroke()
                  const angle = Math.atan2(end.y - start.y, end.x - start.x)
                  const size = Math.max(9, stroke.width * 3.2)
                  ctx.beginPath()
                  ctx.moveTo(end.x, end.y)
                  ctx.lineTo(end.x - size * Math.cos(angle - Math.PI / 7), end.y - size * Math.sin(angle - Math.PI / 7))
                  ctx.moveTo(end.x, end.y)
                  ctx.lineTo(end.x - size * Math.cos(angle + Math.PI / 7), end.y - size * Math.sin(angle + Math.PI / 7))
                  ctx.stroke()
                } else if (stroke.type === 'text') {
                  ctx.font = '600 ' + Math.max(14, stroke.size) + 'px -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif'
                  ctx.textBaseline = 'top'
                  ctx.fillText(stroke.text, points[0].x, points[0].y)
                }
              }
              ctx.restore()
            }
            resolve(canvas)
          }
          image.src = imageUrl
        })
      }

      /** 导出成 JPEG（挂附件/存盘用）：和以前一样，但复用 renderRegion。 */
      function exportShot() {
        if (!sel) return
        renderRegion().then(canvas => {
          canvas.toBlob(blob => {
            closeShot()
            if (blob) void saveScreenshot(blob, '截图-' + stamp() + '.jpg')
          }, 'image/jpeg', 0.9)
        }).catch(() => closeShot())
      }

      /** canvas → PNG Blob，失败时给出可读错误。 */
      function toPng(canvas) {
        return new Promise((resolve, reject) => {
          canvas.toBlob(blob => {
            if (blob) resolve(blob)
            else reject(new Error(L('生成图片失败', 'Could not render the image')))
          }, 'image/png')
        })
      }

      const selectionKey = () => (sel ? [sel.x, sel.y, sel.w, sel.h].map(value => Math.round(value)).join(',') : '')

      /** 提取选区里的文字：结果进面板，同时提示成功/失败。 */
      async function extractText() {
        if (!sel || extractRef.current === 'loading') return
        extractRef.current = 'loading'
        selAtExtract.current = selectionKey()
        setExtract({ status: 'loading', text: '', lines: [], engine: '' })
        setPanelOpen(true)
        try {
          const canvas = await renderRegion()
          const blob = await toPng(canvas)
          const result = await ocrRegion(blob)
          // 识别期间用户又改了选区，这份结果就不是他要的，丢掉。
          if (selAtExtract.current !== selectionKey()) return
          extractRef.current = 'ready'
          setExtract({ status: 'ready', text: result.text || '', lines: result.lines || [], engine: result.engine || '' })
        } catch (error) {
          extractRef.current = 'error'
          setExtract({ status: 'error', text: '', lines: [], engine: '', error: friendly(error) })
          toast(S.textFailed + friendly(error), { kind: 'error' })
        }
      }

      /** 没取过字就直接取字并复制；取过了就只复制。 */
      async function copyText() {
        if (extract && extract.status === 'ready' && extract.text) {
          try {
            await putClipboard('text', { text: extract.text })
            copiedToast('text')
          } catch (error) {
            toast(S.copyFailed + friendly(error), { kind: 'error' })
          }
          return
        }
        await extractText()
      }

      /** 复制选区图片：先存成 PNG（取字/复制文件都复用这个文件），再放进剪贴板。 */
      async function copyImage(as) {
        if (!sel || copying !== null) return
        setCopying(as === 'files' ? 'file' : 'image')
        try {
          const canvas = await renderRegion()
          const blob = await toPng(canvas)
          const name = '截图-' + stamp() + '.png'
          const uploaded = await uploadBlob(blob, name, 'image')
          if (as === 'files') {
            await putClipboard('files', { path: uploaded.file })
            copiedToast('files')
          } else {
            await putClipboard('image', { blob })
            copiedToast('image')
          }
        } catch (error) {
          toast(S.copyFailed + friendly(error), { kind: 'error' })
        } finally {
          setCopying(null)
        }
      }

      /** 复制文字后收起面板，露出完整截图看哪里已复制。 */
      function finishTextPanel() {
        setPanelOpen(false)
      }

      function confirmRegion() {
        if (!sel) return
        const scaleX = imageW / disp.w
        const scaleY = imageH / disp.h
        const virtual = shot.virtual || { x: 0, y: 0, w: imageW, h: imageH }
        const region = {
          type: 'region',
          x: Math.round(virtual.x + sel.x * scaleX * (virtual.w / imageW)),
          y: Math.round(virtual.y + sel.y * scaleY * (virtual.h / imageH)),
          w: Math.max(16, Math.round(sel.w * scaleX * (virtual.w / imageW))),
          h: Math.max(16, Math.round(sel.h * scaleY * (virtual.h / imageH))),
          name: '自定义区域',
        }
        const options = shot.options || {}
        closeShot()
        void startRecording(region, options)
      }

      function confirmCurrent() {
        if (isRegion) { confirmRegion(); return }
        if (!sel) return
        exportShot()
      }

      useEffect(() => {
        const shortcuts = (state.settings || DEFAULT_SETTINGS).shortcuts || DEFAULT_SETTINGS.shortcuts
        // 面板里选中文字按 Ctrl+C 交给浏览器，不能当「复制图片」。
        const inPanel = event => {
          const target = event.target
          return Boolean(target && typeof target.closest === 'function' && target.closest('.vsr-text-panel'))
        }
        const onKey = event => {
          if (event.key === 'Escape') {
            event.preventDefault()
            if (textInput) { setTextInput(null); return }
            closeShot()
            return
          }
          if (textInput || inPanel(event)) return
          if (event.key === 'Enter') {
            event.preventDefault()
            confirmCurrent()
            return
          }
          if (matchesShortcut(event, shortcuts.text)) {
            event.preventDefault()
            if (phase === 'annotate' && !isRegion && sel) void extractText()
            return
          }
          if (matchesShortcut(event, shortcuts.clipboard)) {
            event.preventDefault()
            if (phase === 'annotate' && !isRegion && sel) void copyImage('files')
            return
          }
          if (matchesShortcut(event, shortcuts.copyImage)) {
            event.preventDefault()
            if (phase === 'annotate' && !isRegion && sel) void copyImage('image')
            return
          }
          if (matchesShortcut(event, shortcuts.save)) {
            event.preventDefault()
            confirmCurrent()
            return
          }
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
            event.preventDefault()
            setStrokes(current => current.slice(0, -1))
          }
        }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
      })

      const settings = (state.settings || DEFAULT_SETTINGS)
      const shortcuts = settings.shortcuts || DEFAULT_SETTINGS.shortcuts
      // 取字不自动触发：截完立刻识别会多一次等待，用户会以为截图卡了。
      // 要用就点「文」或按取字快捷键。

      const colors = ['#e5484d', '#f5a623', '#2ea44f', '#1677ff', '#ffffff', '#111111']
      return h('div', { className: 'vsr-overlay vsr-overlay-shot' },
        h('div', { className: 'vsr-shot-stage' },
          h('div', { ref: wrapRef, className: 'vsr-shot-wrap', style: { width: disp.w, height: disp.h }, onMouseDown: onDown, onMouseMove: onMove, onMouseUp: onUp, onMouseLeave: onUp },
            h('img', { src: imageUrl, className: 'vsr-shot-image', draggable: false, width: disp.w, height: disp.h, alt: '' }),
            h('canvas', { ref: canvasRef, className: 'vsr-shot-canvas' }),
            textInput ? h('input', {
              className: 'vsr-text-input',
              style: { left: textInput.x, top: textInput.y },
              autoFocus: true,
              value: textInput.value,
              onChange: event => setTextInput({ ...textInput, value: event.target.value }),
              onKeyDown: event => {
                if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); commitText() }
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setTextInput(null) }
              },
              onBlur: commitText,
            }) : null),
          h('div', { className: 'vsr-shot-topbar' },
            h('span', null, isRegion ? S.regionHint : S.shotHint),
            ),
          phase === 'annotate' && !isRegion ? h('div', { className: 'vsr-toolbar-floating' },
            h('div', { className: 'vsr-toolgroup' },
              ...[['pen', '✎', S.pen], ['rect', '▭', S.rect], ['arrow', '↗', S.arrow], ['text', 'T', S.text]].map(([key, glyph, label]) =>
                h('div', { key, className: 'vsr-tip-host' },
                  h('button', { type: 'button', className: 'vsr-tool' + (tool === key ? ' vsr-tool-active' : ''), 'aria-label': label, onClick: () => setTool(key) }, glyph),
                  h(Tip, { label }))),
              h('span', { className: 'vsr-sep' }),
              ...colors.map(value => h('button', { key: value, type: 'button', className: 'vsr-swatch' + (color === value ? ' vsr-swatch-active' : ''), style: { background: value }, title: value, onClick: () => setColor(value) })),
              h('span', { className: 'vsr-sep' }),
              ...[2, 3, 5].map(value => h('button', { key: value, type: 'button', className: 'vsr-tool' + (lineWidth === value ? ' vsr-tool-active' : ''), title: String(value), onClick: () => setLineWidth(value) }, h('span', { className: 'vsr-width-dot', style: { width: value + 2, height: value + 2 } }))),
              h('span', { className: 'vsr-sep' }),
              h('div', { className: 'vsr-tip-host' },
                h('button', { type: 'button', className: 'vsr-tool', 'aria-label': S.reselect, onClick: () => { setPhase('select'); setSel(null) } }, '⟲'),
                h(Tip, { label: S.reselect })),
              h('div', { className: 'vsr-tip-host' },
                h('button', { type: 'button', className: 'vsr-tool', 'aria-label': S.undo, onClick: () => setStrokes(current => current.slice(0, -1)) }, '↶'),
                h(Tip, { label: S.undo })),
              h('div', { className: 'vsr-tip-host' },
                h('button', { type: 'button', className: 'vsr-tool', 'aria-label': S.clear, onClick: () => setStrokes([]) }, '🗑'),
                h(Tip, { label: S.clear }))),
            // 取字与复制：和 QQ / 微信截图一样的一排操作，不带「用这张」那么大的视觉权重。
            // 浮层里的提示只写按钮名称，不标快捷键——这一排按钮太密，
            // 键帽一放上去就把提示撑宽、盖住相邻按钮。
            h('div', { className: 'vsr-toolgroup' },
              h('div', { className: 'vsr-tip-host' },
                h('button', {
                  type: 'button',
                  className: 'vsr-tool vsr-tool-text' + (extract && extract.status === 'ready' ? ' vsr-tool-on' : ''),
                  'aria-label': S.extractText,
                  onClick: () => { void extractText() },
                }, '文'),
                h(Tip, { label: S.extractText })),
              h('div', { className: 'vsr-tip-host' },
                h('button', {
                  type: 'button',
                  className: 'vsr-tool vsr-tool-text',
                  'aria-label': S.copyImage,
                  disabled: Boolean(copying),
                  onClick: () => { void copyImage('image') },
                }, '⧉'),
                h(Tip, { label: S.copyImage })),
              h('div', { className: 'vsr-tip-host' },
                h('button', {
                  type: 'button',
                  className: 'vsr-tool vsr-tool-text',
                  'aria-label': S.copyFile,
                  disabled: Boolean(copying),
                  onClick: () => { void copyImage('files') },
                }, '⤓'),
                h(Tip, { label: S.copyFile }))),
            h('div', { className: 'vsr-toolgroup' },
              h('div', { className: 'vsr-tip-host' },
                h('button', { type: 'button', className: 'vsr-btn-text', onClick: closeShot }, S.cancel),
                h(Tip, { label: S.cancel })),
              h('div', { className: 'vsr-tip-host' },
                h('button', { type: 'button', className: 'vsr-btn-primary', onClick: confirmCurrent }, S.useShot),
                h(Tip, { label: S.useShot })))) : null,
          phase === 'select' && isRegion ? h('div', { className: 'vsr-toolbar-floating' },
            h('div', { className: 'vsr-toolgroup' },
              h('button', { type: 'button', className: 'vsr-btn-text', onClick: closeShot }, S.cancel),
              h('button', { type: 'button', className: 'vsr-btn-primary', disabled: !sel, onClick: confirmCurrent }, S.recordRegion))) : null,
          // 文字面板：和 QQ / 微信的取字一样，识别结果直接可选中、可一键复制。
          phase === 'annotate' && !isRegion && extract && panelOpen
            ? h(TextPanel, {
              extract,
              shortcut: shortcuts.text,
              onCopy: () => { void copyText() },
              onClose: finishTextPanel,
              onRetry: () => { extractRef.current = null; void extractText() },
            })
            : null,
          phase === 'annotate' && !isRegion && extract && extract.status === 'ready' && !panelOpen
            ? h('button', { type: 'button', className: 'vsr-panel-reopen', onClick: () => setPanelOpen(true) }, '文 ' + S.showTextPanel)
            : null))
    }

    /**
     * 取字结果面板：状态（识别中/有字/没字/失败）+ 可选中文字 + 复制按钮。
     */
    function TextPanel(props) {
      const value = props.extract
      const chars = (value.text || '').replace(/\s/g, '').length
      let body
      if (value.status === 'loading') {
        body = h('div', { className: 'vsr-panel-status' }, h('span', { className: 'vsr-spinner' }), S.extracting)
      } else if (value.status === 'error') {
        body = h('div', { className: 'vsr-panel-status vsr-panel-error' },
          h('span', null, value.error || S.ocrUnavailable),
          h('button', { type: 'button', className: 'vsr-panel-link', onClick: props.onRetry }, L('重试', 'Retry')))
      } else if (!value.text || chars === 0) {
        body = h('div', { className: 'vsr-panel-status' }, S.noText)
      } else {
        // 用 div + user-select:text 而不是 textarea：看得见整段、能按行读，
        // 选中后 Ctrl+C 由浏览器自己处理（面板里的按键不再当快捷键）。
        body = h('div', { className: 'vsr-panel-text', tabIndex: 0, onClick: event => event.stopPropagation() }, value.text)
      }
      return h('div', { className: 'vsr-text-panel', onClick: event => event.stopPropagation() },
        h('div', { className: 'vsr-panel-head' },
          h('strong', null, S.textPanelTitle),
          value.status === 'ready' && chars > 0 ? h('span', { className: 'vsr-panel-meta' }, S.ocrCharacters(chars)) : null,
          h('button', {
            type: 'button',
            className: 'vsr-panel-copy',
            disabled: value.status !== 'ready' || chars === 0,
            onClick: props.onCopy,
          }, S.copyText),
          h('button', { type: 'button', className: 'vsr-panel-x', 'aria-label': S.hideTextPanel, onClick: props.onClose }, '×')),
        body,
        value.status === 'ready' && chars > 0
          ? h('div', { className: 'vsr-panel-foot' }, L('拖动选择部分文字，Ctrl+C 复制；点「复制文字」复制全部（', 'Drag to select, Ctrl+C to copy; “Copy text” copies all (') + props.shortcut + ')')
          : null)
    }

    // ------------------------------------------------------------- overlays
    function RecordingPill(props) {
      const now = useNow(true)
      const seconds = Math.max(0, Math.floor((now - props.recording.startedAt) / 1000))
      return h('div', { className: 'vsr-rec-pill vsr-rec-pill-floating' },
        h('span', { className: 'vsr-dot' }),
        h('span', null, S.recording + ' ' + formatDuration(seconds)),
        h('button', { type: 'button', className: 'vsr-link vsr-link-light', onClick: () => { void stopRecording() } }, S.stop))
    }

    function AgentPill(props) {
      const now = useNow(true)
      const seconds = Math.max(0, Math.floor((now - props.agent.startedAt) / 1000))
      return h('div', { className: 'vsr-rec-pill vsr-rec-pill-floating' },
        h('span', { className: 'vsr-dot' }),
        h('span', null, L('Agent 正在录屏 ', 'Agent recording ') + formatDuration(seconds)))
    }

    function ProgressCard(props) {
      const ratio = Math.max(0, Math.min(1, props.ratio || 0))
      return h('div', { className: 'vsr-progress' },
        h('div', { className: 'vsr-progress-title' }, props.stage),
        h('div', { className: 'vsr-bar' }, h('div', { className: 'vsr-bar-fill', style: { width: Math.round(ratio * 100) + '%' } })))
    }

    function ToastCard(props) {
      const value = props.toast
      return h('div', { className: 'vsr-toast' + (value.kind === 'error' ? ' vsr-toast-error' : '') },
        h('span', { className: 'vsr-toast-text' }, value.text),
        value.path ? h('button', { type: 'button', className: 'vsr-link', onClick: () => { void reveal(value.path) } }, S.openingFolder) : null,
        h('button', { type: 'button', className: 'vsr-toast-x', onClick: () => setState({ toast: null }), 'aria-label': S.close }, '×'))
    }

    function RootOverlay() {
      const snapshot = useStore()
      const children = []
      if (snapshot.phase === 'recording' && snapshot.recording) children.push(h(RecordingPill, { key: 'rec', recording: snapshot.recording }))
      if (snapshot.agentRecording) children.push(h(AgentPill, { key: 'agent', agent: snapshot.agentRecording }))
      // starting 阶段不出任何浮层：启动抓帧和截图都不能把本插件的提示拍进画面。
      if (snapshot.phase === 'encoding' && snapshot.progress) children.push(h(ProgressCard, { key: 'enc', stage: snapshot.progress.stage, ratio: snapshot.progress.ratio }))
      if (snapshot.picker) children.push(h(Picker, { key: 'picker', picker: snapshot.picker }))
      if (snapshot.shot) children.push(h(ScreenshotOverlay, { key: 'shot', shot: snapshot.shot }))
      if (snapshot.toast) children.push(h(ToastCard, { key: 'toast', toast: snapshot.toast }))
      if (children.length === 0) return null
      return ReactDOM.createPortal(h(React.Fragment, null, ...children), document.body)
    }

    // ------------------------------------------------------------------ css
    const CSS = `
.vsr-toolbar { display: inline-flex; align-items: center; gap: 2px; }
.vsr-btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 28px; min-width: 28px; padding: 0 6px; border: 0; border-radius: 6px; background: transparent; color: var(--dsh-color-text-secondary, #6b7280); cursor: pointer; font: inherit; }
.vsr-btn:hover:not(:disabled) { background: var(--dsh-color-fill-quaternary, rgba(0,0,0,.06)); color: var(--dsh-color-text-primary, #111827); }
.vsr-btn:disabled { opacity: .45; cursor: default; }
.vsr-btn-rec { color: #e5484d; }
/* 悬停提示：默认 display:none，只有悬停时才出现。
   用 display 而不是 opacity——opacity:0 的元素仍占布局、仍可能吃指针事件，
   而且在某些渲染路径下会被截图/合成器当成可见元素。 */
.vsr-btn-wrap { position: relative; display: inline-flex; }
.vsr-tip { position: absolute; left: 50%; bottom: calc(100% + 8px); transform: translateX(-50%); z-index: 2147483200; pointer-events: none; display: none; }
.vsr-btn-wrap:hover .vsr-tip,
.vsr-btn-wrap:focus-within .vsr-tip { display: inline-flex; }
.vsr-tip-end { left: auto; right: 0; transform: none; }
.vsr-tip-body { display: inline-flex; align-items: center; gap: 8px; padding: 5px 9px; border-radius: 7px; background: rgba(28,28,31,.96); color: #f2f2f4; font: 500 12px/1.3 -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; box-shadow: 0 8px 24px rgba(0,0,0,.3); white-space: nowrap; }
.vsr-tip-label { white-space: nowrap; }
.vsr-tip-hint { color: #a9a9b2; font-weight: 400; }
.vsr-tip-keys { display: inline-flex; align-items: center; gap: 3px; margin-left: 2px; }
.vsr-kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 4px; border: 1px solid rgba(255,255,255,.22); border-bottom-width: 2px; background: rgba(255,255,255,.1); color: #fff; font: 500 11px/1 ui-monospace, SFMono-Regular, Consolas, "Courier New", monospace; }
@media (prefers-color-scheme: light) {
  .vsr-tip-body { background: rgba(32,32,36,.94); }
}
.vsr-rec-pill { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 8px; border-radius: 12px; background: rgba(229,72,77,.12); color: #e5484d; font-size: 12px; font-variant-numeric: tabular-nums; }
.vsr-rec-pill-floating { position: fixed; top: 18px; left: 50%; transform: translateX(-50%); z-index: 2147483001; height: 32px; padding: 0 12px; gap: 8px; background: rgba(20,20,22,.88); color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.35); backdrop-filter: blur(8px); }
.vsr-dot { width: 8px; height: 8px; border-radius: 50%; background: #e5484d; box-shadow: 0 0 0 0 rgba(229,72,77,.6); animation: vsr-pulse 1.4s infinite; }
@keyframes vsr-pulse { 0% { box-shadow: 0 0 0 0 rgba(229,72,77,.6); } 70% { box-shadow: 0 0 0 7px rgba(229,72,77,0); } 100% { box-shadow: 0 0 0 0 rgba(229,72,77,0); } }
/* 抓屏的那一帧，本插件的浮层/提示一律不可见，避免被拍进图里。
   工具条按钮是 DSH 常驻界面的一部分，保留——用户截的就是当前界面。 */
html.vsr-capturing .vsr-overlay,
html.vsr-capturing .vsr-progress,
html.vsr-capturing .vsr-toast { visibility: hidden !important; }
.vsr-overlay { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.55); backdrop-filter: blur(3px); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; }
.vsr-modal { width: 420px; max-width: calc(100vw - 32px); max-height: 82vh; display: flex; flex-direction: column; background: var(--dsh-color-bg-elevated, #fff); color: var(--dsh-color-text-primary, #1f2329); border-radius: 14px; box-shadow: 0 24px 80px rgba(0,0,0,.38); overflow: hidden; }
.vsr-modal-narrow { width: 360px; }
.vsr-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 10px; font-size: 14px; }
.vsr-x { border: 0; background: transparent; color: inherit; font-size: 20px; line-height: 1; cursor: pointer; opacity: .55; padding: 0 3px; }
.vsr-x:hover { opacity: 1; }
.vsr-scroll { overflow: auto; padding: 0 10px 8px; }
.vsr-section { display: block; width: 100%; padding: 10px 6px 6px; font-size: 11px; letter-spacing: .04em; color: var(--dsh-color-text-tertiary, #8a8f98); text-align: left; background: transparent; border: 0; }
.vsr-section-toggle { cursor: pointer; }
.vsr-chevron { display: inline-block; width: 12px; font-size: 10px; }
.vsr-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 8px; border: 1px solid transparent; border-radius: 10px; background: transparent; color: inherit; text-align: left; cursor: pointer; font: inherit; }
.vsr-row:hover { background: var(--dsh-color-fill-quaternary, rgba(0,0,0,.05)); }
.vsr-row-last { border-color: var(--dsh-color-accent, #1677ff); background: color-mix(in srgb, var(--dsh-color-accent, #1677ff) 8%, transparent); }
.vsr-row-custom { margin-top: 4px; }
.vsr-thumb { width: 72px; height: 44px; border-radius: 6px; background: #111; flex: none; }
.vsr-custom-icon { display: flex; align-items: center; justify-content: center; width: 72px; height: 44px; flex: none; border-radius: 6px; border: 1px dashed var(--dsh-color-border, rgba(0,0,0,.25)); font-size: 20px; color: var(--dsh-color-text-tertiary, #8a8f98); }
.vsr-row-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.vsr-row-name { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px; }
.vsr-row-detail { font-size: 11px; color: var(--dsh-color-text-tertiary, #8a8f98); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px; }
.vsr-modal-foot { display: flex; align-items: center; gap: 14px; padding: 10px 16px 12px; border-top: 1px solid var(--dsh-color-border, rgba(0,0,0,.08)); font-size: 12px; flex-wrap: wrap; }
.vsr-picker-foot { gap: 12px; }
.vsr-check { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
.vsr-hint { margin-left: auto; color: var(--dsh-color-text-tertiary, #8a8f98); font-size: 11px; }
.vsr-link { border: 0; background: transparent; color: var(--dsh-color-accent, #1677ff); cursor: pointer; font: inherit; padding: 0; }
.vsr-link-light { color: #8fc2ff; }
.vsr-error { padding: 10px 16px 16px; color: #e5484d; font-size: 13px; line-height: 1.5; }
.vsr-muted { color: var(--dsh-color-text-tertiary, #8a8f98); font-size: 13px; }
.vsr-overlay-shot { background: rgba(0,0,0,.62); }
.vsr-shot-stage { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.vsr-shot-wrap { position: relative; cursor: crosshair; box-shadow: 0 20px 70px rgba(0,0,0,.45); border-radius: 2px; overflow: hidden; }
.vsr-shot-image { display: block; user-select: none; pointer-events: none; }
.vsr-shot-canvas { position: absolute; inset: 0; }
.vsr-shot-topbar { display: flex; align-items: center; gap: 14px; color: #fff; font-size: 12px; opacity: .9; }
.vsr-text-input { position: absolute; z-index: 2; min-width: 80px; padding: 2px 4px; border: 1px dashed #fff; background: rgba(0,0,0,.35); color: #fff; font: 600 16px -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; outline: none; }
.vsr-toolbar-floating { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 12px; background: rgba(24,24,27,.94); color: #fff; box-shadow: 0 16px 48px rgba(0,0,0,.45); backdrop-filter: blur(10px); z-index: 2147483200; }
/* 工具条永远压在文字面板之上：面板再怎么长，也不能盖住按钮的点击区。
   面板自己从 bottom 之上开始长，并限制高度。 */
.vsr-toolgroup { display: flex; align-items: center; gap: 3px; }
.vsr-tool { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 0; border-radius: 6px; background: transparent; color: #e7e7ea; cursor: pointer; font-size: 14px; }
.vsr-tool:hover { background: rgba(255,255,255,.12); }
.vsr-tool-active { background: rgba(22,119,255,.85); color: #fff; }
.vsr-sep { width: 1px; height: 18px; background: rgba(255,255,255,.18); margin: 0 4px; }
.vsr-swatch { width: 16px; height: 16px; border-radius: 50%; border: 1px solid rgba(255,255,255,.35); cursor: pointer; padding: 0; }
.vsr-swatch-active { outline: 2px solid #fff; outline-offset: 1px; }
.vsr-width-dot { display: inline-block; border-radius: 50%; background: #e7e7ea; }
.vsr-btn-text { border: 0; background: transparent; color: #cfcfd4; cursor: pointer; font: inherit; padding: 0 6px; }
.vsr-btn-text:hover { color: #fff; }
.vsr-btn-primary { border: 0; border-radius: 7px; background: #1677ff; color: #fff; cursor: pointer; font: inherit; padding: 6px 12px; }
.vsr-btn-primary:disabled { opacity: .45; cursor: default; }
/* 浮层工具条上的悬停提示：和工具条一样是深色底，所以提示反色成浅色。 */
.vsr-tip-host { position: relative; display: inline-flex; }
.vsr-tip-host .vsr-tip { bottom: calc(100% + 10px); }
/* 浮层里的提示同样只在悬停时出现。 */
.vsr-tip-host:hover .vsr-tip,
.vsr-tip-host:focus-within .vsr-tip { display: inline-flex; }
.vsr-tip-host .vsr-tip-body { background: #f6f6f8; color: #1c1c1f; box-shadow: 0 8px 24px rgba(0,0,0,.45); }
.vsr-tip-host .vsr-tip-hint { color: #6b7280; }
.vsr-tip-host .vsr-kbd { border-color: rgba(0,0,0,.18); background: rgba(0,0,0,.06); color: #1c1c1f; }
.vsr-tool-text { font-size: 13px; font-weight: 600; }
.vsr-tool-on { background: rgba(22,119,255,.85); color: #fff; }
.vsr-tool:disabled { opacity: .45; cursor: default; }
/* 取字结果面板：贴在工具条上方，深色、可选中文字。 */
/* 取字结果面板：贴在工具条上方，深色、可选中文字。
   bottom 留出工具条高度（24px 下边距 + 约 44px 工具条 + 12px 间隙），
   max-height 用视口高度减去这段，保证再长也不会压住工具条。 */
/* 取字面板贴着工具条上方，宽度收窄并限制高度，避免盖住画布：
   用户看完字还要继续画圈写字，面板一挡就没法下手了。 */
.vsr-text-panel { position: fixed; left: 50%; bottom: 92px; transform: translateX(-50%); z-index: 2147483100; display: flex; flex-direction: column; width: min(520px, calc(100vw - 32px)); max-height: min(30vh, calc(100vh - 320px)); border-radius: 12px; background: rgba(24,24,27,.96); color: #f2f2f4; box-shadow: 0 18px 52px rgba(0,0,0,.5); backdrop-filter: blur(10px); font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; overflow: hidden; pointer-events: auto; }
/* 面板本身可点，但不应把它和工具条之间的空隙也变成点击面。 */
.vsr-panel-head { display: flex; align-items: center; gap: 8px; padding: 8px 10px 8px 12px; border-bottom: 1px solid rgba(255,255,255,.1); font-size: 12px; }
.vsr-panel-meta { color: #9a9aa3; font-size: 11px; }
.vsr-panel-copy { margin-left: auto; border: 0; border-radius: 6px; background: #1677ff; color: #fff; font: inherit; font-size: 12px; padding: 4px 10px; cursor: pointer; }
.vsr-panel-copy:disabled { background: rgba(255,255,255,.12); color: #8e8e97; cursor: default; }
.vsr-panel-x { border: 0; background: transparent; color: #cfcfd4; font-size: 16px; line-height: 1; cursor: pointer; padding: 0 2px; }
.vsr-panel-x:hover { color: #fff; }
.vsr-panel-text { flex: 1; min-height: 44px; overflow: auto; padding: 10px 12px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; user-select: text; cursor: text; outline: none; }
.vsr-panel-text::selection { background: rgba(74,163,255,.45); }
.vsr-panel-status { display: flex; align-items: center; gap: 8px; padding: 14px 12px; font-size: 12px; color: #cfcfd4; }
.vsr-panel-error { color: #ff9a9e; flex-wrap: wrap; }
.vsr-panel-link { border: 0; background: transparent; color: #8fc2ff; font: inherit; font-size: 12px; cursor: pointer; padding: 0; }
.vsr-panel-foot { padding: 6px 12px 8px; border-top: 1px solid rgba(255,255,255,.08); color: #8e8e97; font-size: 11px; }
.vsr-panel-reopen { position: fixed; left: 50%; bottom: 92px; transform: translateX(-50%); z-index: 2147483100; border: 1px solid rgba(255,255,255,.2); border-radius: 999px; background: rgba(24,24,27,.94); color: #f2f2f4; font: inherit; font-size: 12px; padding: 5px 12px; cursor: pointer; }
.vsr-spinner { width: 12px; height: 12px; border-radius: 50%; border: 2px solid rgba(255,255,255,.25); border-top-color: #4aa3ff; animation: vsr-spin .8s linear infinite; }
@keyframes vsr-spin { to { transform: rotate(360deg); } }
.vsr-progress { position: fixed; left: 50%; top: 50%; transform: translate(-50%,-50%); z-index: 2147483001; width: 300px; padding: 18px 20px; border-radius: 14px; background: rgba(24,24,27,.94); color: #fff; box-shadow: 0 24px 80px rgba(0,0,0,.45); backdrop-filter: blur(10px); font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; }
.vsr-progress-title { font-size: 13px; margin-bottom: 12px; }
.vsr-bar { height: 4px; border-radius: 2px; background: rgba(255,255,255,.16); overflow: hidden; }
.vsr-bar-fill { height: 100%; border-radius: 2px; background: linear-gradient(90deg, #1677ff, #4aa3ff); transition: width .2s ease; }
.vsr-toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 2147483002; display: flex; align-items: center; gap: 12px; max-width: min(720px, calc(100vw - 32px)); padding: 10px 14px; border-radius: 10px; background: rgba(24,24,27,.94); color: #fff; font-size: 12px; box-shadow: 0 16px 48px rgba(0,0,0,.4); backdrop-filter: blur(10px); font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; }
.vsr-toast-error { background: rgba(120,24,32,.96); }
.vsr-toast-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vsr-toast-x { border: 0; background: transparent; color: #fff; opacity: .55; cursor: pointer; font-size: 16px; line-height: 1; }
.vsr-toast-x:hover { opacity: 1; }
.vsr-settings { max-width: 900px; padding: 4px 2px 32px; display: flex; flex-direction: column; gap: 14px; color: var(--dsh-color-text-primary, #1f2329); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; }
.vsr-settings-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.vsr-settings-head h2 { margin: 0 0 4px; font-size: 18px; font-weight: 600; }
.vsr-card { border: 1px solid var(--dsh-color-border, rgba(0,0,0,.09)); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; background: var(--dsh-color-bg-elevated, #fff); }
.vsr-card h3 { margin: 0; font-size: 13px; font-weight: 600; }
.vsr-storage-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.vsr-grow { flex: 1; min-width: 220px; }
.vsr-input, .vsr-select { height: 32px; padding: 0 10px; border: 1px solid var(--dsh-color-border, rgba(0,0,0,.16)); border-radius: 8px; background: transparent; color: inherit; font: inherit; font-size: 13px; }
.vsr-input[type="number"] { width: 90px; }
.vsr-shortcut-input { width: 170px; cursor: pointer; }
.vsr-btn-outline { border: 1px solid var(--dsh-color-border, rgba(0,0,0,.16)); background: transparent; color: inherit; border-radius: 8px; height: 32px; padding: 0 12px; cursor: pointer; font: inherit; font-size: 12px; }
.vsr-btn-outline:hover { background: var(--dsh-color-fill-quaternary, rgba(0,0,0,.05)); }
.vsr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px 14px; }
.vsr-field { display: flex; flex-direction: column; gap: 5px; font-size: 12px; }
.vsr-field-label { color: var(--dsh-color-text-secondary, #6b7280); }
.vsr-field-note { color: var(--dsh-color-text-tertiary, #8a8f98); font-size: 11px; }
.vsr-checks { display: flex; gap: 18px; flex-wrap: wrap; font-size: 12px; }
.vsr-path { word-break: break-all; }
.vsr-settings-actions { display: flex; align-items: center; gap: 12px; }
.vsr-settings-link { border: 0; background: transparent; color: var(--dsh-color-accent, #1677ff); cursor: pointer; font: inherit; font-size: 12px; padding: 0; }
.vsr-settings-link:disabled { opacity: .45; cursor: default; }
.vsr-danger { color: #e5484d; }
.vsr-library-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.vsr-library-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.vsr-filter { border: 1px solid var(--dsh-color-border, rgba(0,0,0,.16)); background: transparent; color: inherit; border-radius: 999px; padding: 3px 10px; font: inherit; font-size: 12px; cursor: pointer; }
.vsr-filter-on { border-color: var(--dsh-color-accent, #1677ff); color: var(--dsh-color-accent, #1677ff); background: rgba(22,119,255,.1); }
.vsr-file-list { display: flex; flex-direction: column; gap: 2px; max-height: 340px; overflow: auto; }
.vsr-file-row { display: flex; align-items: center; gap: 10px; padding: 7px 4px; border-bottom: 1px solid var(--dsh-color-border, rgba(0,0,0,.07)); font-size: 12px; }
.vsr-file-kind { flex: none; min-width: 36px; padding: 2px 6px; border-radius: 5px; background: rgba(22,119,255,.12); color: #1677ff; text-align: center; font-size: 11px; }
.vsr-file-kind-image { background: rgba(46,164,79,.14); color: #2ea44f; }
.vsr-file-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vsr-file-meta { flex: none; color: var(--dsh-color-text-tertiary, #8a8f98); font-size: 11px; }
.vsr-empty { color: var(--dsh-color-text-tertiary, #8a8f98); font-size: 12px; padding: 12px 0; }
.vsr-convert { display: flex; flex-direction: column; gap: 6px; }
@media (prefers-color-scheme: dark) {
  .vsr-modal { background: #1f2329; color: #e8e9eb; }
  .vsr-modal-foot { border-top-color: rgba(255,255,255,.1); }
}
`

    function installStyles() {
      if (document.getElementById('vyra-screen-recorder-style')) return
      const style = document.createElement('style')
      style.id = 'vyra-screen-recorder-style'
      style.textContent = CSS
      document.head.appendChild(style)
    }

    // ----------------------------------------------------------------- apply
    function apply(ctx) {
      try {
        installStyles()
        void loadClientSettings()
        ctx.effect(() => ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: 'dsh-vyra-screen-recorder.tools',
          order: 10,
        }, Toolbar)), 'dsh-vyra-screen-recorder: toolbar')
        ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'dsh-vyra-screen-recorder.overlay',
          order: 90,
        }, RootOverlay)), 'dsh-vyra-screen-recorder: overlay')
        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'dsh-vyra-screen-recorder',
          order: 37,
          label: () => L('录屏截图', 'Screen recorder'),
        }, SettingsPage)), 'dsh-vyra-screen-recorder: settings')
        ctx.effect(() => ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
          name: 'settings.section.icon',
          id: 'dsh-vyra-screen-recorder',
          order: 37,
        }, SettingsIcon)), 'dsh-vyra-screen-recorder: settings icon')
        // 官方插件管理页也给每个 bundle 一个配置插槽；老宿主没有这个插槽时静默跳过。
        try {
          ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
            name: 'plugins.bundle.config',
            key: 'dsh-vyra-screen-recorder',
            order: 37,
          }, SettingsPage)), 'dsh-vyra-screen-recorder: plugin page settings')
        } catch { /* 老宿主没有插件页配置槽 */ }
        const onShortcut = event => {
          if (event.repeat) return
          if (state.picker || state.shot) return
          // 只有「真的在往输入场地写文字」时才让位给浏览器：
          // 多行输入框 / 文本域 / 可编辑区。单行的搜索框、下拉框不拦，
          // 否则用户打完字再按截图快捷键会毫无反应（录屏有按钮入口，
          // 截图没有，表现就是「截图快捷键坏了」）。
          if (isTypingTarget(event.target) && !isShortcutCombo(event)) return
          const settings = state.settings || DEFAULT_SETTINGS
          if (matchesShortcut(event, settings.shortcuts.screenshot)) {
            if (state.phase !== 'idle') return
            event.preventDefault()
            // 快捷键直接整屏截图；选源是工具条按钮的路径。
            void takeScreenshotQuick()
            return
          }
          if (matchesShortcut(event, settings.shortcuts.record)) {
            if (state.agentRecording) return
            if (state.phase === 'recording') { event.preventDefault(); void stopRecording() }
            else if (state.phase === 'idle') { event.preventDefault(); void openPicker() }
          }
        }
        window.addEventListener('keydown', onShortcut, true)
        ctx.effect(() => () => window.removeEventListener('keydown', onShortcut, true), 'dsh-vyra-screen-recorder: shortcuts')
        const onPageHide = () => {
          if (state.phase === 'recording' || state.phase === 'starting') {
            try { navigator.sendBeacon(PREFIX + '/record/discard', '') } catch { /* ignore */ }
          }
        }
        window.addEventListener('pagehide', onPageHide)
        ctx.effect(() => () => window.removeEventListener('pagehide', onPageHide), 'dsh-vyra-screen-recorder: pagehide')
        startAgentWatch()
        ctx.effect(() => () => stopAgentWatch(), 'dsh-vyra-screen-recorder: agent watch')
        // 插件热更/页面刷新后，宿主可能还挂着上一路录制；主动清掉，避免临时目录泄漏。
        // Agent 队列里的录制不能清：它还要等本页面编码。
        apiJson('/record/status').then(status => {
          if (!status || !status.recording) return null
          return apiJson('/agent/status').then(agent => {
            if (agent && agent.job) return null
            return apiJson('/record/discard', { method: 'POST' })
          })
        }).catch(() => {})
      } catch (error) {
        try { console.warn('[dsh-vyra-screen-recorder] apply failed', error) } catch { /* ignore */ }
      }
    }

    exports.apply = apply
    exports.inject = ['slots']
    exports.__test = { getState, setState, attachFile, findComposerFileInput }
    return module.exports
  },
})
