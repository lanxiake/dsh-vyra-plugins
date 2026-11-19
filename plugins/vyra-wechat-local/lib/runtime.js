// 解释器定位：优先用配置里的 python，其次用 uv 现取（仓库里 xianyu 插件已采用同一约定）。
// sidecar.py 的两个依赖由 uv 在首次运行时取好并缓存，仓库里不放运行时。
import { existsSync } from 'node:fs'
import { join, delimiter } from 'node:path'

const WIN = process.platform === 'win32'

/** 在 PATH 里找一个可执行文件（Windows 按 PATHEXT 补后缀）。 */
export function whichSync(name) {
  const exts = WIN ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : ['']
  for (const dir of (process.env.PATH || '').split(delimiter)) {
    if (!dir) continue
    for (const ext of exts) {
      const candidate = join(dir, name + ext)
      if (existsSync(candidate)) return candidate
    }
  }
  return undefined
}

/**
 * 返回 spawn 所需的 command/args。
 * @param {{pythonPath?: string, pythonArgs?: string[]}} config
 */
export function resolveRuntime({ pythonPath = '', pythonArgs = [] } = {}) {
  if (pythonPath) {
    return { command: pythonPath, args: [...pythonArgs, '-u', 'vyra_sidecar.py'], source: 'config' }
  }
  const uv = whichSync('uv')
  if (!uv) {
    throw new Error(
      '找不到 uv：请安装 uv（https://docs.astral.sh/uv/），或在插件配置里设置 pythonPath 指向一个已装好 pycryptodome 的 Python。',
    )
  }
  return {
    command: uv,
    args: [
    'run',
    '--quiet',
    '--with', 'pycryptodome',
    '--with', 'zstandard',
    '--with', 'pilk',
    '--with', 'sherpa-onnx',
    '--with', 'numpy',
    '--python', '3.12',
    'python', '-u', 'vyra_sidecar.py',
  ],
    source: 'uv',
  }
}