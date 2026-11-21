/**
 * DSH Plugin Hub — the community plugin marketplace for DeepSeek Harness.
 * Website: https://dsh-plugin.org
 * GitHub: https://github.com/dshplugin/dsh-plugin-hub
 *
 * 设置行用的紧凑开关。基于原生 button，可键盘聚焦并通过 aria-checked 播报状态；
 * 样式由 --hub-* 变量驱动（开 = 品牌填充，关 = 中性轨道）。
 */
import { createElement as h } from 'react'
import styles from '../../styles/Toggle.module.css'

export function Toggle({ checked, onChange, title, disabled }: {
  checked: boolean
  onChange: (next: boolean) => void
  title?: string
  disabled?: boolean
}) {
  return h('button', {
    type: 'button',
    role: 'switch',
    'aria-checked': checked,
    disabled,
    title,
    className: checked ? styles.toggleOn : styles.toggle,
    onClick: () => onChange(!checked),
  }, h('span', { className: styles.knob }))
}
