/**
 * DSH Plugin Hub — the community plugin marketplace for DeepSeek Harness.
 * Website: https://dsh-plugin.org
 * GitHub: https://github.com/dshplugin/dsh-plugin-hub
 *
 * 安装与卸载弹窗共用的内联进度块：真实百分比进度条（服务端估算、客户端轮询）。
 * 不做实时终端窗口 —— pnpm 在 git clone/构建期间几乎无输出，日志面板大部分时间是空的；
 * 失败时完整输出在 ErrorModal 里展示。
 */
import { createElement as h } from 'react'
import styles from '../../styles/Modal.module.css'
import type { TaskState } from '../../types.ts'

export function ProgressView({ task }: { task: TaskState }) {
  return h('div', { className: styles.progress },
    h('div', { className: styles.progressHead },
      h('span', { className: styles.progressText }, `${Math.round(task.progress)}%`),
    ),
    h('div', { className: styles.progressTrack },
      h('div', {
        className: task.status === 'failed' ? `${styles.progressFill} ${styles.progressFillFail}` : styles.progressFill,
        style: { width: `${task.progress}%` },
      }),
    ),
  )
}
