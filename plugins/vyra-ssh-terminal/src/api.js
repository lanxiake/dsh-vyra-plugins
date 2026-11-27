/** 所有界面对着这个前缀说话；后端每个接口注册成一条 exact 路由。 */
export const BASE = '/api/ssh-terminal/'

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const url = (route, query) => {
  if (!query) return BASE + route
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) q.set(k, v)
  const s = q.toString()
  return BASE + route + (s ? '?' + s : '')
}

async function parse(res) {
  const text = await res.text()
  let value
  try {
    value = JSON.parse(text)
  } catch {
    throw new ApiError(
      `服务端没有返回 JSON(HTTP ${res.status}),插件的后端可能没有加载,请重启 DSH 后再试`,
      res.status
    )
  }
  if (!res.ok) throw new ApiError(value.error || `请求失败(HTTP ${res.status})`, res.status, value.code)
  return value
}

/** 一个 POST 或 GET 的薄包装：body 省略即 GET，且不吃缓存（SSE 之外的接口都要最新）。 */
export async function api(route, body, query) {
  return parse(
    await fetch(
      url(route, query),
      body !== undefined
        ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
        : { cache: 'no-store' }
    )
  )
}

export async function upload(query, file, onProgress) {
  // 传不传进度都走同一条路：XHR 的 upload.onprogress 是目前唯一可靠的「已发出多少
  // 字节」来源。fetch 至今没有可用的请求体进度（ReadableStream 上传还没进标准），
  // 所以这里不为了一个小文件用两套代码。
  if (!onProgress) return parse(await fetch(url('files/upload', query), { method: 'POST', body: file }))
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url('files/upload', query))
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress({ loaded: e.loaded, total: e.total })
    }
    xhr.onload = () => {
      let value
      try {
        value = JSON.parse(xhr.responseText)
      } catch {
        reject(new ApiError(`服务端没有返回 JSON(HTTP ${xhr.status})`, xhr.status))
        return
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(value)
      else reject(new ApiError(value.error || `上传失败(HTTP ${xhr.status})`, xhr.status, value.code))
    }
    xhr.onerror = () => reject(new ApiError('上传中断：连接被重置', 0))
    xhr.onabort = () => reject(new ApiError('已取消上传', 0, 'aborted'))
    xhr.send(file)
  })
}

/**
 * 导出：幻灯片本体就是文件（纯备份 JSON），所以这里不能走 `parse()`——它会把文件
 * 当成接口回执去解析。正文原样返回，报告信息从 `x-export-*` 头里读。
 *
 * @returns {Promise<{text: string, filename: string, connections: number, folders: number, keys: number, passwords: number, missing: number}>}
 */
export async function exportBundle({ scope, id, passphrase }) {
  const res = await fetch(url('export'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scope, id, passphrase: passphrase || '' })
  })
  const text = await res.text()
  if (!res.ok) {
    let message = `导出失败(HTTP ${res.status})`
    try {
      message = JSON.parse(text).error || message
    } catch {
      // 非 JSON 错误体就保留状态码
    }
    throw new ApiError(message, res.status)
  }
  const header = (name) => res.headers.get(name) || ''
  const name = header('x-export-name')
  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    // 后端如果哪天改了形状，报告里按 0 报也不会让导出失败
  }
  return {
    text,
    filename: name ? decodeURIComponent(name) : filenameOf(res.headers.get('content-disposition')) || 'ssh-terminal-backup.json',
    connections: Number(header('x-export-connections')) || 0,
    folders: parsed?.folders?.length ?? 0,
    keys: Number(header('x-export-keys')) || 0,
    passwords: Number(header('x-export-passwords')) || 0,
    missing: Number(header('x-export-missing')) || 0
  }
}

/**
 * 下载走 fetch → Blob → <a download>，而不是把 URL 直接挂在链接上。
 *
 * 直挂链接时浏览器自己决定落在哪（通常是默认下载目录），页面既拿不到文件名也拿不到
 * 落点，用户点完之后不知道东西去了哪里。走 Blob 至少能把文件名定下来，并且由调用方
 * 在界面上明确说出「存到哪」。
 *
 * @returns {Promise<{name: string, size: number}>}
 */
export async function download(query, onProgress) {
  const res = await fetch(url('files/download', query), { cache: 'no-store' })
  if (!res.ok) {
    let message = `下载失败(HTTP ${res.status})`
    try {
      message = (await res.json()).error || message
    } catch {
      // 响应体不是 JSON 时保留 HTTP 状态即可
    }
    throw new ApiError(message, res.status)
  }
  const total = Number(res.headers.get('content-length')) || 0
  let blob
  if (onProgress && res.body && typeof res.body.getReader === 'function') {
    // 自己把流读出来：只有这样才能边收边报进度，而不是等全部到齐才动一下。
    const reader = res.body.getReader()
    const chunks = []
    let loaded = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      loaded += value.length
      onProgress({ loaded, total })
    }
    blob = new Blob(chunks)
  } else {
    blob = await res.blob()
  }
  const name = filenameOf(res.headers.get('content-disposition')) || String(query?.name || 'download')
  saveBlob(blob, name)
  return { name, size: blob.size }
}

/** 从 `attachment; filename*=UTF-8''xxx` / `filename="xxx"` 里取回文件名。 */
export function filenameOf(header) {
  if (!header) return ''
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (star) {
    try {
      return decodeURIComponent(star[1].trim())
    } catch {
      return star[1].trim()
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain ? plain[1].trim() : ''
}

/** 把 Blob 交给浏览器保存；不支持的浏览器退回 `URL.createObjectURL`。 */
export function saveBlob(blob, name) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = name
  a.rel = 'noopener'
  document.body.append(a)
  a.click()
  a.remove()
  // 立刻 revoke 会让部分浏览器的下载中断，给一个足够长的宽限。
  setTimeout(() => URL.revokeObjectURL(href), 60_000)
}
