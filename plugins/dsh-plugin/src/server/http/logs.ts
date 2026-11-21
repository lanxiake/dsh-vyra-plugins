/**
 * DSH Plugin Hub — the community plugin marketplace for DeepSeek Harness.
 * Website: https://dsh-plugin.org
 * GitHub: https://github.com/dshplugin/dsh-plugin-hub
 *
 * 日志路由：分页日志查看器、清空、在文件管理器中定位，以及选择日志目录的原生文件夹选择器。
 */
import { spawn } from 'node:child_process'
import { dirname } from 'node:path'
import { appendLog, clearLog, readLog, logFilePath, defaultLogFilePath } from '../services/log.ts'
import { requireMethod, requireTrustedPost, sendJson, type WebRoute, type WebServerService } from './shared.ts'

export function registerLogsRoutes(webServer: WebServerService, profile: string): WebRoute[] {
  return [
    {
      kind: 'exact',
      path: '/dsh-plugin-hub/logs',
      handler: (request, response) => {
        if (!requireMethod(request, response, 'GET')) return
        // 日志查看器分页接口：?offset=&limit=&category=&level=&query=，返回过滤后的倒序分页
        try {
          const url = new URL(request.url ?? '/', 'http://localhost')
          const num = (name: string): number | undefined => {
            const v = url.searchParams.get(name)
            if (v === null || v === '') return undefined
            const n = Number(v)
            return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined
          }
          const limit = Math.min(num('limit') ?? 200, 500)
          const category = url.searchParams.get('category') ?? 'all'
          const level = url.searchParams.get('level') ?? 'all'
          const query = url.searchParams.get('query') ?? ''
          const result = readLog(profile, {
            offset: num('offset') ?? 0,
            limit,
            category: category as 'all' | 'install' | 'uninstall' | 'update' | 'diagnostics' | 'settings' | 'system',
            level: level as 'all' | 'debug' | 'info' | 'success' | 'warn' | 'error',
            query,
          })
          sendJson(response, 200, {
            entries: result.entries,
            total: result.total,
            offset: num('offset') ?? 0,
            limit,
            hasMore: result.total > (num('offset') ?? 0) + result.entries.length,
            path: logFilePath(profile),
            defaultPath: defaultLogFilePath(profile),
          })
        } catch {
          sendJson(response, 400, { error: 'invalid log query' })
        }
      },
    },
    {
      kind: 'exact',
      path: '/dsh-plugin-hub/clear-log',
      handler: (request, response) => {
        if (!requireTrustedPost(request, response)) return
        // 清空所有日志：截断当前日志文件为空
        try {
          const ok = clearLog(profile)
          if (!ok) {
            sendJson(response, 500, { error: 'failed to clear log' })
            return
          }
          appendLog(profile, { at: Date.now(), level: 'info', category: 'system', event: 'system.clear', message: '日志已由用户清空' })
          sendJson(response, 200, { ok: true })
        } catch {
          sendJson(response, 500, { error: 'failed to clear log' })
        }
      },
    },
    {
      kind: 'exact',
      path: '/dsh-plugin-hub/open-log',
      handler: (request, response) => {
        if (!requireTrustedPost(request, response)) return
        // 在系统文件管理器里定位日志文件（macOS Finder -R / Windows explorer /select, / Linux xdg-open）
        try {
          const file = logFilePath(profile)
          const bin = process.platform === 'darwin' ? 'open'
            : process.platform === 'win32' ? 'explorer'
              : 'xdg-open'
          const args = process.platform === 'darwin' ? ['-R', file]
            : process.platform === 'win32' ? ['/select,', file]
              : [file]
          const child = spawn(bin, args, { stdio: 'ignore', detached: true })
          child.once('error', () => sendJson(response, 500, { error: 'failed to open log file' }))
          child.once('spawn', () => sendJson(response, 200, { ok: true }))
        } catch {
          sendJson(response, 500, { error: 'failed to open log file' })
        }
      },
    },
    // 系统目录选择器：弹原生文件夹对话框让用户挑日志存放目录（macOS osascript /
    // Windows FolderBrowserDialog / Linux zenity），选中返回绝对路径，取消返回 cancelled。
    // 与 open-log 不同，这里必须等对话框关闭才能拿结果，所以阻塞收集 stdout 再应答。
    // 对话框默认定位到当前日志文件所在目录 —— 每台机器/平台的默认位置都不同，
    // 这里动态取 logFilePath() 的目录，用户打开就在「它原来的位置」附近。
    {
      kind: 'exact',
      path: '/dsh-plugin-hub/choose-log-dir',
      handler: (request, response) => {
        if (!requireTrustedPost(request, response)) return
        try {
          const title = 'DSH Plugin Hub — choose log folder'
          const startDir = dirname(logFilePath(profile))
          let bin: string
          let args: string[]
          if (process.platform === 'darwin') {
            bin = 'osascript'
            args = ['-e', `POSIX path of (choose folder with prompt "${title}" default location (POSIX file "${startDir}"))`]
          } else if (process.platform === 'win32') {
            bin = 'powershell.exe'
            args = ['-NoProfile', '-STA', '-Command', [
              'Add-Type -AssemblyName System.Windows.Forms',
              '$f = New-Object System.Windows.Forms.FolderBrowserDialog',
              `$f.Description = '${title}'`,
              // 初始定位到当前日志目录（单引号字符串内反斜杠不转义，Windows 路径原样传入）
              `$f.SelectedPath = '${startDir}'`,
              'if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $f.SelectedPath } else { "" }',
            ].join('; ')]
          } else {
            bin = 'zenity'
            args = ['--file-selection', '--directory', `--title=${title}`, `--filename=${startDir}`]
          }
          const child = spawn(bin, args)
          let out = ''
          child.stdout.on('data', (d) => { out += String(d) })
          // spawn 失败（如 Linux 无 zenity）会先触发 error 再触发 close（code=-2）：
          // 只允许第一个事件应答，否则第二次 sendJson 对已结束的响应再 writeHead，
          // 抛 ERR_HTTP_HEADERS_SENT 成为宿主进程内的未捕获异常。
          let done = false
          const finish = (reply: () => void) => { if (!done) { done = true; reply() } }
          child.on('error', () => finish(() => sendJson(response, 500, { error: 'directory picker unavailable' })))
          child.on('close', (code) => finish(() => {
            // macOS osascript 输出带引号（如 "/Users/x"），统一剥掉首尾空白与引号
            const picked = out.trim().replace(/^"|"$/g, '')
            if (code === 0 && picked !== '') sendJson(response, 200, { path: picked })
            else sendJson(response, 200, { cancelled: true })
          }))
        } catch {
          sendJson(response, 500, { error: 'directory picker unavailable' })
        }
      },
    },
  ]
}
