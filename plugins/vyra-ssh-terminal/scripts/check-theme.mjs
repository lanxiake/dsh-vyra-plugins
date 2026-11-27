/**
 * 主题适配检查：样式表里不许出现「把某一种主题写死」的颜色。
 *
 * 这条规则的来历：上一版把 LiteShell 的深色（#1c2130、#232a3d）直接写成
 * `--sx-hover` / `--sx-active` 的固定值，结果在浅色主题下，凡是选中/悬停的地方
 * 都变成一块接近纯黑——用户看到的就是"整体白色里突然一块黑"。
 *
 * 允许的硬编码只有一种：实心强调色/危险色**上面**的文字（白字），因为那两处底色
 * 本身就是明确的品牌色或错误色，配白字在明暗主题下都成立。
 */
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
// 先把整段块注释抹掉（保留行数，行号仍对得上），再逐行检查。
// 注释里引用别家库的原始颜色（"xterm.css 里 .xterm{background:#000}"）不算隐患：
// 那是在记录「为什么要覆盖它」，不是在用这个颜色。
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
const lines = stripped.split(/\r?\n/)

const problems = []

lines.forEach((line, i) => {
  const n = i + 1
  // 注释里引用别的库的原始值（例如 "xterm.css 里 .xterm{background:#000}"）不算隐患：
  // 那是在记录"为什么要覆盖它"，不是在用这个颜色。
  const code = line.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\*.*$/, '')
  const hex = code.match(/#[0-9a-fA-F]{3,8}\b/g)
  if (!hex) return

  // 变量定义区（.sx-root 里那段）允许兜底值，但必须是浅色系——见下面的亮度检查
  const isTokenLine = /^\s*--sx-[\w-]+\s*:/.test(code)

  for (const h of hex) {
    const rgb = toRgb(h)
    if (!rgb) continue
    const lum = luminance(rgb)

    if (isTokenLine) {
      const name = /--sx-([\w-]+)/.exec(line)?.[1] ?? ''
      // 只有「会被当成底色/填充色」的令牌才要求够浅；fg 是文字色，本来就该深。
      const isBackgroundToken = /^(bg|bg2|side|pop|hover|active|sel)$/.test(name) || /^b\d$/.test(name)
      if (isBackgroundToken && lum < 0.55) {
        problems.push(`${n}: 背景类兜底色 --sx-${name} = ${h} 太暗（亮度 ${lum.toFixed(2)}），浅色主题下会变成暗块`)
      }
      continue
    }

    // 非变量行：只允许白字压在品牌/危险色上
    const isWhiteText = /color\s*:\s*#(fff|ffffff)\b/i.test(line)
    if (!isWhiteText) {
      problems.push(`${n}: 硬编码颜色 ${h} —— 应该用 var(--sx-*) 令牌或其 color-mix 派生值`)
    }
  }
})

function toRgb(hex) {
  let h = hex.slice(1)
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  if (h.length !== 6) return null
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

/** 感知亮度（sRGB 近似）。 */
function luminance([r, g, b]) {
  const f = (v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function saturation([r, g, b]) {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  if (max === 0) return 0
  return (max - min) / max
}

if (problems.length) {
  console.log(`✗ ${problems.length} 处主题隐患：`)
  for (const p of problems) console.log('  ' + p)
  process.exitCode = 1
} else {
  console.log('OK: 没有写死主题的颜色')
}