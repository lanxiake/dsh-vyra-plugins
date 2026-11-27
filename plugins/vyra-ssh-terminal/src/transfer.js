/**
 * 传输（上传 / 下载）的进度台账。
 *
 * 对齐 LiteShell 的传输面板：每一条传输都有名字、方向、百分比、状态（进行中 /
 * 完成 / 失败）和出错原因。**状态放在模块级而不是组件里**——用户可能在传输途中切标签
 * 或收起抽屉，进度不能跟着组件一起消失；回来时应该还能看到它跑到哪了。
 *
 * 只管家务事（记账、算百分比），不碰 DOM，也不发请求：真正的字节搬运在 api.js。
 */

/** @typedef {{id: string, name: string, direction: 'up'|'down', size: number, loaded: number, state: 'running'|'done'|'failed', error?: string, from: string, to: string, startedAt: number}} Transfer */

/** 最多保留多少条记录：传输是流水账，看的是"最近这批怎么样了"。 */
const KEEP = 30

/** @type {Transfer[]} */
const list = []
let seq = 0
/** 状态变化时通知界面重画。由调用方接上 notify()。 */
let notifyFn = null

export const onTransferChange = (fn) => {
  notifyFn = fn
}
const emit = () => notifyFn?.()

/** 当前全部传输，最近的在最前面。 */
export const transfers = () => list

/** 进度百分比；总大小未知时返回 0，界面据此显示不确定态。 */
export function transferPct(t) {
  if (!t || !t.size) return 0
  return Math.min(100, Math.max(0, Math.round((t.loaded / t.size) * 100)))
}

/** 有没有还在跑的传输（用来决定要不要继续轮询界面）。 */
export const transferBusy = () => list.some((t) => t.state === 'running')

/**
 * 开一条传输记录。
 * @param {{name: string, direction: 'up'|'down', size: number, from: string, to: string}} info
 */
export function startTransfer(info) {
  const t = {
    id: `t${++seq}`,
    name: String(info.name ?? ''),
    direction: info.direction,
    size: Number(info.size) || 0,
    loaded: 0,
    state: 'running',
    from: String(info.from ?? ''),
    to: String(info.to ?? ''),
    startedAt: Date.now(),
  }
  list.unshift(t)
  if (list.length > KEEP) list.length = KEEP
  emit()
  return t
}

/** 更新已传字节。 */
export function progressTransfer(t, loaded) {
  if (!t || t.state !== 'running') return
  t.loaded = Math.max(0, Number(loaded) || 0)
  // 服务器给了准确总长就以它为准（分块编码时 total 可能是 0）
  emit()
}

/** 收尾：`error` 为空即成功。 */
export function finishTransfer(t, error) {
  if (!t || t.state !== 'running') return
  if (error) {
    t.state = 'failed'
    t.error = error instanceof Error ? error.message : String(error)
  } else {
    t.state = 'done'
    // 服务器没报总长时，完成后的已传字节就是总大小
    if (!t.size) t.size = t.loaded
    t.loaded = t.size
  }
  emit()
}

/** 清掉已经结束的记录（进行中的保留）。 */
export function clearFinished() {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].state !== 'running') list.splice(i, 1)
  emit()
}

/**
 * 清空全部记录，**包括进行中的**。
 *
 * 只给测试用：监控面板关掉、或者连接断开时，那几条"永远跑不完"的记录会让
 * `transferBusy()` 永远为真，界面据此还在轮询。正常路径请用 clearFinished()。
 */
export function resetTransfers() {
  list.length = 0
  emit()
}

/** 百分比也好、字节数也好，界面统一走这里，免得两处算法漂移。 */
export function formatBytes(n) {
  const v = Number(n) || 0
  if (v < 1024) return `${v} B`
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`
  if (v < 1024 * 1024 * 1024) return `${(v / 1048576).toFixed(1)} MB`
  return `${(v / 1073741824).toFixed(2)} GB`
}

/** 速度（字节/秒）→ 人读的大小。由调用方算好速率再传进来。 */
export const formatRate = (bytesPerSec) => `${formatBytes(Number(bytesPerSec) || 0)}/s`
