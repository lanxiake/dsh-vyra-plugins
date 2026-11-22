/**
 * 播放页外壳 — Folia's `VisualizerShell` rebuilt for this panel.
 *
 * Every player page is these five layers, bottom to top:
 *
 *   backdrop   封面模糊 / 流光 / 场景 / 视频（切样式时保留，不重建）
 *   stage      当前歌词样式的渲染器，铺满整页
 *   shade      压暗与渐变，保证文字可读
 *   chrome     顶部（返回、标题）与底部（播放胶囊）
 *   overlay    队列、歌词设置、音频效果等面板
 *
 * The page composes slots into this shell instead of hand-building columns, which is
 * what makes a style swap a swap of `stage` only.
 */

function PlayerShell(props) {
  return h(
    'div',
    {
      // Inline positioning: the shell is an overlay regardless of the injected sheet.
      // `mp-np` keeps the existing lyric rules applying to it.
      // is-open is the old page's open state; without it `.mp-np` keeps the shell hidden.
      className: 'mp-shell mp-np is-open' + (props.compact === true ? ' is-compact' : ''),
      style: {
        position: 'absolute',
        inset: '0',
        zIndex: '120',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#101014',
        color: '#f4f4f5',
      },
    },
    h('div', { className: 'mp-shell-backdrop', 'aria-hidden': 'true' }, props.backdrop || null),
    h('div', { className: 'mp-shell-stage' }, props.stage || null),
    h('div', { className: 'mp-shell-shade', 'aria-hidden': 'true' }),
    props.topBar
      ? h('div', { className: 'mp-shell-top' }, props.topBar)
      : null,
    props.bottomBar
      ? h('div', { className: 'mp-shell-bottom' }, props.bottomBar)
      : null,
    props.overlay ? h('div', { className: 'mp-shell-overlay' }, props.overlay) : null,
  )
}
