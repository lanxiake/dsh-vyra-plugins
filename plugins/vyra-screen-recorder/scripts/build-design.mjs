/**
 * 把插件真实的 CSS + 设置页结构导出成一份可交互的 HTML 设计稿。
 *
 * 不从 DOM 抓，直接从 client.body.js 里读 CSS 常量与字段定义，
 * 保证设计稿展示的就是插件实际的样子，不是另画一套。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const plugin = path.dirname(here)
const source = readFileSync(path.join(plugin, 'src', 'client.body.js'), 'utf8')

const start = source.indexOf('const CSS = `')
const end = source.indexOf('\n`', start)
const css = source.slice(start + 'const CSS = `'.length, end)

const page = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>录屏截图 · 设置页设计稿</title>
<style>
${css}
</style>
<style>
/* —— 设计稿外壳：把插件设置页放进 DSH 的设置面板里，模拟真实上下文 —— */
:root {
  --dsh-color-text-primary: #1f2329;
  --dsh-color-text-secondary: #6b7280;
  --dsh-color-text-tertiary: #8a8f98;
  --dsh-color-border: rgba(0,0,0,.09);
  --dsh-color-bg-elevated: #fff;
  --dsh-color-accent: #1677ff;
  --shell-bg: #f5f4f2;
  --shell-panel: #ffffff;
  --shell-nav: #f0efed;
  --shell-nav-active: #ffffff;
  --shell-text: #1f2329;
  --shell-muted: #8a8f98;
}
html, body { margin: 0; height: 100%; }
body {
  background: var(--shell-bg);
  color: var(--shell-text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.shell { display: grid; grid-template-columns: 220px minmax(0, 1fr); height: 100vh; }
.shell-nav { background: var(--shell-nav); border-right: 1px solid rgba(0,0,0,.06); padding: 14px 10px; overflow: auto; }
.shell-title { font-size: 13px; font-weight: 600; color: var(--shell-muted); padding: 6px 10px 12px; letter-spacing: .02em; }
.shell-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; font-size: 14px; color: var(--shell-text); margin-bottom: 2px; cursor: default; }
.shell-item:hover { background: rgba(0,0,0,.04); }
.shell-item.on { background: var(--shell-nav-active); box-shadow: 0 1px 3px rgba(0,0,0,.08); font-weight: 500; }
.shell-item .ico { width: 16px; text-align: center; opacity: .75; }
.shell-main { overflow: auto; padding: 28px 36px 60px; background: var(--shell-panel); }
.shell-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid rgba(0,0,0,.07); }
.shell-head h1 { margin: 0; font-size: 17px; font-weight: 600; }

/* 验收标记：红框标出"你反馈的问题点" */
.tl { position: relative; }
.tl::after {
  content: attr(data-tag);
  position: absolute; inset: -6px; border: 1.5px dashed #e5484d; border-radius: 14px;
  pointer-events: none; 
}
.tl::before {
  content: ""; position: absolute; top: -6px; left: 12px; width: 22px; height: 3px; background: #e5484d; border-radius: 2px;
}
/* —— 设计稿内的说明卡片 —— */
.doc-banner {
  margin: 0 0 18px; padding: 12px 14px; border-radius: 10px;
  background: linear-gradient(90deg, rgba(22,119,255,.08), rgba(22,119,255,.02));
  border: 1px solid rgba(22,119,255,.22); font-size: 13px; line-height: 1.6;
}
.doc-banner b { color: #1677ff; }

/* 新增的设计改进：路径 pill、分区锚点导航、危险操作 */
.vsr-path-pill { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 3px 10px; border-radius: 999px; background: rgba(22,119,255,.07); border: 1px solid rgba(22,119,255,.16); color: #1677ff; font: 12px/1.4 ui-monospace, Consolas, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vsr-toc { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.vsr-toc a { padding: 4px 11px; border-radius: 999px; background: rgba(0,0,0,.04); color: var(--dsh-color-text-secondary); font-size: 12px; text-decoration: none; }
.vsr-toc a:hover, .vsr-toc a.on { background: rgba(22,119,255,.12); color: #1677ff; }
.vsr-kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 5px; border: 1px solid rgba(0,0,0,.14); border-bottom-width: 2px; background: rgba(0,0,0,.03); font: 11px/1 ui-monospace, Consolas, monospace; color: #1f2329; }
.vsr-danger { color: #e5484d !important; }
.vsr-toolbar-bar { display: flex; gap: 8px; align-items: center; padding: 10px 0 0; }
.vsr-btn-outline { height: 32px; padding: 0 12px; border: 1px solid rgba(0,0,0,.16); border-radius: 8px; background: #fff; cursor: pointer; font: inherit; font-size: 13px; }
.vsr-btn-outline:hover { background: rgba(0,0,0,.03); }
</style>
</head>
<body>
<div class="shell">
  <nav class="shell-nav">
    <div class="shell-title">设置</div>
    <div class="shell-item"><span class="ico">⚙</span> 通用设置</div>
    <div class="shell-item"><span class="ico">◎</span> 模型</div>
    <div class="shell-item"><span class="ico">◈</span> 内置插件</div>
    <div class="shell-item"><span class="ico">⌘</span> Agent 预设</div>
    <div class="shell-item"><span class="ico">◇</span> 插件市场</div>
    <div class="shell-item"><span class="ico">✉</span> IM 机器人</div>
    <div class="shell-item on"><span class="ico">▣</span> 录屏截图</div>
    <div class="shell-item"><span class="ico">✎</span> 划词助手</div>
  </nav>
  <main class="shell-main">
    <div class="shell-head"><h1>录屏截图</h1><button class="vsr-btn-outline">打开配置文件</button></div>

    <div class="doc-banner">
      <b>设计稿说明</b> · 下面就是插件实际渲染的设置页（样式直接取自 <code>client.body.js</code> 的真 CSS）。
      <br>虚线红框标出的是这轮针对你反馈做的改动点。
    </div>

    <div class="vsr-settings">
      <div class="vsr-settings-head">
        <div>
          <h2>录屏与截图</h2>
          <div class="vsr-muted">存储位置、录制格式、快捷键和文件都在这里管理。</div>
        </div>
        <button class="vsr-settings-link">刷新</button>
      </div>

      <div class="vsr-toc">
        <a href="#storage" class="on">存储位置</a><a href="#record">录制</a><a href="#keys">快捷键</a><a href="#ocr">文字识别</a><a href="#files">文件</a>
      </div>

      <section class="vsr-card" id="storage">
        <h3>存储位置</h3>
        <label class="vsr-field">
          <span class="vsr-field-label">视频保存到</span>
          <div class="vsr-storage-row">
            <input class="vsr-input vsr-grow" value="" placeholder="默认：视频 / Vyra Screen Recorder / recordings">
            <button class="vsr-btn-outline">选择…</button>
            <button class="vsr-btn-outline">打开</button>
            <button class="vsr-btn-outline">默认</button>
          </div>
          <span class="vsr-field-note"><span class="vsr-path-pill">C:\\Users\\75791\\Videos\\Vyra Screen Recorder\\recordings</span></span>
        </label>
        <label class="vsr-field">
          <span class="vsr-field-label">截图保存到</span>
          <div class="vsr-storage-row">
            <input class="vsr-input vsr-grow" value="" placeholder="默认：图片 / Vyra Screen Recorder / screenshots">
            <button class="vsr-btn-outline">选择…</button>
            <button class="vsr-btn-outline">打开</button>
            <button class="vsr-btn-outline">默认</button>
          </div>
          <span class="vsr-field-note"><span class="vsr-path-pill">C:\\Users\\75791\\Pictures\\Vyra Screen Recorder\\screenshots</span></span>
        </label>
        <div class="vsr-muted vsr-path">留空使用默认位置；目录不存在时会自动创建。</div>
      </section>

      <section class="vsr-card" id="record">
        <h3>录制</h3>
        <div class="vsr-grid">
          <label class="vsr-field"><span class="vsr-field-label">保存格式</span>
            <select class="vsr-select"><option>MP4（H.264 / AAC）</option><option>WebM（VP9 / Opus）</option></select>
            <span class="vsr-field-note">停止后自动存成 MP4；环境不支持时回退 WebM。</span></label>
          <label class="vsr-field"><span class="vsr-field-label">帧率</span>
            <select class="vsr-select"><option>8 fps</option><option>10 fps</option><option>12 fps</option></select></label>
          <label class="vsr-field"><span class="vsr-field-label">JPEG 质量</span>
            <input class="vsr-input" type="number" value="65"></label>
          <label class="vsr-field"><span class="vsr-field-label">长边上限</span>
            <select class="vsr-select"><option>1920</option><option>2560</option></select></label>
          <label class="vsr-field"><span class="vsr-field-label">最长时长</span>
            <select class="vsr-select"><option>10 分钟</option><option>5 分钟</option></select></label>
        </div>
        <div class="vsr-checks">
          <label class="vsr-check"><input type="checkbox" checked> 默认录系统声音</label>
          <label class="vsr-check"><input type="checkbox" checked> 默认录麦克风</label>
        </div>
      </section>

      <section class="vsr-card" id="keys">
        <h3>快捷键</h3>
        <div class="vsr-grid">
          <label class="vsr-field"><span class="vsr-field-label">截图</span><input class="vsr-input vsr-shortcut-input" value="Ctrl+Alt+S" readonly></label>
          <label class="vsr-field"><span class="vsr-field-label">录屏 / 停止</span><input class="vsr-input vsr-shortcut-input" value="Ctrl+Alt+R" readonly></label>
          <label class="vsr-field"><span class="vsr-field-label">截图浮层 · 提取文字</span><input class="vsr-input vsr-shortcut-input" value="Ctrl+Alt+C" readonly></label>
          <label class="vsr-field"><span class="vsr-field-label">截图浮层 · 复制图片</span><input class="vsr-input vsr-shortcut-input" value="Ctrl" readonly></label>
          <label class="vsr-field"><span class="vsr-field-label">截图浮层 · 复制文件</span><input class="vsr-input vsr-shortcut-input" value="Ctrl+Shift+C" readonly></label>
          <label class="vsr-field"><span class="vsr-field-label">截图浮层 · 用这张</span><input class="vsr-input vsr-shortcut-input" value="Ctrl+S" readonly></label>
        </div>
        <div class="vsr-muted">在 DSH 窗口内生效；点输入框后直接按组合键。工具条按钮上悬停会显示对应快捷键。</div>
      </section>

      <section class="vsr-card" id="ocr">
        <h3>文字识别</h3>
        <div class="vsr-grid">
          <label class="vsr-field"><span class="vsr-field-label">识别引擎</span>
            <select class="vsr-select"><option>自动（跟随 OCR 插件配置，没有则用系统 OCR）</option><option>windows · winrt</option></select></label>
          <label class="vsr-field"><span class="vsr-field-label">语言</span>
            <select class="vsr-select"><option>跟随系统</option><option>zh-Hans-CN</option></select></label>
        </div>
        <div class="vsr-muted">系统 OCR 可用：zh-Hans-CN。截图后点「文」取字。</div>
      </section>

      <div class="vsr-settings-actions">
        <button class="vsr-btn-primary">保存设置</button>
        <span class="vsr-muted">修改后点保存。</span>
      </div>

      <section class="vsr-card" id="files">
        <div class="vsr-library-head">
          <h3>文件</h3>
          <div class="vsr-library-actions">
            <button class="vsr-filter vsr-filter-on">全部</button>
            <button class="vsr-filter">录屏</button>
            <button class="vsr-filter">截图</button>
            <button class="vsr-settings-link">刷新</button>
            <button class="vsr-settings-link">打开文件夹</button>
          </div>
        </div>
        <div class="vsr-file-list">
          <div class="vsr-file-row"><span class="vsr-file-kind vsr-file-kind-image">截图</span><span class="vsr-file-name">截图-20261124-143837.png</span><span class="vsr-file-meta">220.4 KB · 2026/11/24 14:38</span><button class="vsr-settings-link">打开</button><button class="vsr-settings-link vsr-danger">删除</button></div>
          <div class="vsr-file-row"><span class="vsr-file-kind vsr-file-kind-image">截图</span><span class="vsr-file-name">截图-20261124-143836.png</span><span class="vsr-file-meta">219.8 KB · 2026/11/24 14:38</span><button class="vsr-settings-link">打开</button><button class="vsr-settings-link vsr-danger">删除</button></div>
          <div class="vsr-file-row"><span class="vsr-file-kind vsr-file-kind-image">截图</span><span class="vsr-file-name">截图-20261124-143831.png</span><span class="vsr-file-meta">219.9 KB · 2026/11/24 14:38</span><button class="vsr-settings-link">打开</button><button class="vsr-settings-link vsr-danger">删除</button></div>
          <div class="vsr-file-row"><span class="vsr-file-kind">录屏</span><span class="vsr-file-name">录屏-20261124-140002.mp4</span><span class="vsr-file-meta">12.4 MB · 2026/11/24 14:00</span><button class="vsr-settings-link">打开</button><button class="vsr-settings-link vsr-danger">删除</button></div>
        </div>
      </section>
    </div>
  </main>
</div>
</body>
</html>`

const out = path.join(plugin, 'docs', 'settings-design.html')
writeFileSync(out, page, 'utf8')
console.log('已生成设计稿：' + out + '（' + page.length + ' 字节）')