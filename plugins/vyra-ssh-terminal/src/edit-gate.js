/**
 * 哪些远程文件可以进内置编辑器。
 *
 * 这是三道闸门，任何一道不过就退回「下载到本机用系统程序打开」：
 *
 *  1. **扩展名黑名单**：压缩包、二进制、文档、图片音视频、字体、数据库文件——
 *     这些用文本框编辑本来就没有意义，还容易存坏；
 *  2. **内容嗅探**：有 0 字节、或控制字符超过 5%，按二进制处理；
 *  3. **严格 UTF-8 解码**：解不出来（GBK 等）也不给编辑，免得存回去把文件搞坏。
 *
 * 另外超过 2 MB 直接劝退：大文件在文本框里编辑不是好主意，网也不好受。
 *
 * 三个判断都是纯函数——它们错了的代价是「文件被存坏」，必须能被测。
 */

/** 2 MB：再大就不在浏览器里编辑了。 */
export const MAX_EDIT_BYTES = 2 * 1024 * 1024

/** 扩展名黑名单：即便内容是文本，也不适合在文本框里改。 */
const BLOCKED_EXT = new Set([
  // 压缩包
  'zip', 'gz', 'tgz', 'bz2', 'xz', 'zst', '7z', 'rar', 'tar', 'jar', 'war', 'whl', 'deb', 'rpm',
  // 二进制 / 可执行
  'exe', 'dll', 'so', 'dylib', 'bin', 'o', 'a', 'class', 'pyc', 'wasm', 'ko', 'img', 'iso',
  // 数据库
  'db', 'sqlite', 'sqlite3', 'mdb', 'dat',
  // 文档
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt',
  // 图片音视频
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'svgz', 'tiff',
  'mp3', 'mp4', 'avi', 'mkv', 'mov', 'flac', 'wav', 'ogg', 'webm', 'm4a',
  // 字体
  'ttf', 'otf', 'woff', 'woff2', 'eot',
  // 密钥二进制
  'ppk', 'p12', 'pfx', 'jks', 'der',
])

/** 扩展名：只在最后一段里找，且必须像扩展名（1-10 位字母数字）。 */
export function extensionOf(name) {
  const base = String(name ?? '').split(/[\\/]/).pop() ?? ''
  const m = /\.([A-Za-z0-9]{1,10})$/.exec(base)
  return m ? m[1].toLowerCase() : ''
}

/**
 * 判断一个文件能不能进编辑器。
 *
 * @param {{name?: string, path?: string, size?: number}} file 远端文件信息
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function canEdit(file) {
  const name = file?.name ?? file?.path ?? ''
  const size = Number(file?.size ?? 0)
  if (size > MAX_EDIT_BYTES) {
    return { ok: false, reason: `文件有 ${(size / 1048576).toFixed(1)} MB，超过 2 MB 不在页面里编辑` }
  }
  const ext = extensionOf(name)
  if (ext && BLOCKED_EXT.has(ext)) {
    return { ok: false, reason: `.${ext} 属于二进制或归档格式，不适合当文本编辑` }
  }
  return { ok: true }
}

/**
 * 内容嗅探 + 严格 UTF-8 解码。
 *
 * @param {Uint8Array | Buffer} bytes
 * @returns {{ok: true, text: string} | {ok: false, reason: string}}
 */
export function sniffText(bytes) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? [])
  if (buf.length === 0) return { ok: true, text: '' }
  // 含 0 字节：文本文件不会这样
  let control = 0
  for (const b of buf) {
    if (b === 0) return { ok: false, reason: '文件里有 0 字节，是二进制' }
    // 制表、换行、回车之外的控制字符都算"不像文本"
    if (b < 9 || (b > 13 && b < 32)) control++
  }
  if (control / buf.length > 0.05) {
    return { ok: false, reason: `控制字符占 ${((control / buf.length) * 100).toFixed(0)}%，看起来是二进制` }
  }
  try {
    // fatal: true —— 解不出来就报错，而不是静默替换成 U+FFFD 再把坏字符存回去
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(buf) }
  } catch {
    return { ok: false, reason: '不是 UTF-8 编码（可能是 GBK/GB18030），存回去会把文件搞坏' }
  }
}

/** 三道闸门串起来：给界面一个判断。 */
export function decideEdit(file, bytes) {
  const gate = canEdit(file)
  if (!gate.ok) return gate
  return sniffText(bytes)
}
