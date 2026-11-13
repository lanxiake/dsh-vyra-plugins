/**
 * Normalize the imported plugins' manifests for publication.
 *
 * Three fields cannot survive the copy from a local `link:` package:
 *   - `private: true`, which pnpm refuses to install from a registry or Git;
 *   - an absent `license`, which npm publish rejects and which nobody can grant
 *     on the original's behalf, so the repository's own MIT applies;
 *   - a `description` written for the author rather than for the market card.
 *
 * `repository` is stamped from this repository's own location so an installed
 * copy points back here instead of at a path only this machine had.
 *
 * Usage: node scripts/normalize-plugins.mjs
 *
 * @module dsh-vyra-plugins/normalize-plugins
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = 'https://github.com/lanxiake/dsh-vyra-plugins'
const root = resolve(import.meta.dirname, '..')

/** Per-plugin publication metadata, keyed by directory name. */
const PUBLISHED = {
  'vyra-agent-manager': {
    description: '可视化智能体管理：为每个智能体定制自己的提示词、工具与技能，也可以让主智能体自己创建它们。',
    keywords: ['dsh', 'dsh-plugin', 'deepseek-harness', 'agent', 'preset'],
  },
  'vyra-page-translator': {
    description: '像浏览器那样翻译整个页面：按段落切分、批量提交、保留原有的排版与链接。',
    keywords: ['dsh', 'dsh-plugin', 'deepseek-harness', 'translate', 'i18n'],
  },
  'vyra-skill-mcp-manager': {
    description: '技能与 MCP 的一体化管理界面：浏览、搜索、安装，不必再手改 profile 配置。',
    keywords: ['dsh', 'dsh-plugin', 'deepseek-harness', 'skill', 'mcp'],
  },
  'vyra-smart-compaction': {
    description: '分层、由智能体决定的高质量上下文压缩：压力感知、有回收门槛的确定性预剪枝，以及模型可调用的压缩工具。',
    keywords: ['dsh', 'dsh-plugin', 'deepseek-harness', 'compaction', 'context'],
  },
  'vyra-ssh-terminal': {
    description: '内置 SSH 终端：连接档案、跳板、SFTP、端口转发与主机密钥固定，密码只进 DSH 凭据服务。',
    keywords: ['dsh', 'dsh-plugin', 'deepseek-harness', 'ssh', 'terminal', 'sftp'],
  },
}

for (const [name, meta] of Object.entries(PUBLISHED)) {
  const file = join(root, 'plugins', name, 'package.json')
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  delete manifest.private
  manifest.description = meta.description
  manifest.keywords = meta.keywords
  manifest.license = 'MIT'
  manifest.repository = { type: 'git', url: `git+${ROOT}.git`, directory: `plugins/${name}` }
  writeFileSync(file, `${JSON.stringify(manifest, undefined, 2)}\n`)
  const missing = manifest.files.filter((entry) => !existsSync(join(root, 'plugins', name, entry.replace(/\/$/, ''))))
  console.log(`normalized ${name}${missing.length === 0 ? '' : ` (files names no such path: ${missing.join(', ')})`}`)
}
