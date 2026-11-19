// 发送前的硬性护栏：限频、敏感词、连续失败熔断。
// 敏感词表来自参考实现，闲鱼会对图片和正文做 OCR，图里同样不能出现。
export const DEFAULT_SENSITIVE = [
  '微信', '微信号', '加微信', '喂信', '卫星',
  '插件', '外挂', '脚本', '注入', '补丁', '破解', '绿色版', '激活码',
  '自动回复', '代聊', '机器人', '托管', '防撤回', '撤回插件',
  '群发', '批量加人', '加粉', '获客', '引流',
  '监控', '偷看', '采集', '抓取', '爬',
  '网盘', '电子版', '下载链接', '压缩包',
  '永久', '无限', '100%', '零风险', '不封号', '包过',
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function createGuard({
  minIntervalMs = 60000,
  sensitiveWords = DEFAULT_SENSITIVE,
  failureThreshold = 3,
  pauseMs = 30 * 60 * 1000,
} = {}) {
  let lastAt = 0
  let failures = 0
  let pausedUntil = 0

  return {
    // 同一账号连续发经营消息至少间隔 minIntervalMs。
    async wait() {
      const remain = lastAt + minIntervalMs - Date.now()
      if (remain > 0) await sleep(remain)
      lastAt = Date.now()
    },

    // 命中就拒绝发送，不改写、不提示买家。
    check(text) {
      const body = String(text ?? '')
      const hit = sensitiveWords.find((word) => body.includes(word))
      return hit ? { ok: false, hit } : { ok: true }
    },

    recordSuccess() {
      failures = 0
    },

    // 连续 failureThreshold 次接口失败 → 暂停 pauseMs，避免继续撞风控。
    recordFailure() {
      failures += 1
      if (failures >= failureThreshold) {
        pausedUntil = Date.now() + pauseMs
        failures = 0
      }
    },

    isPaused() {
      return Date.now() < pausedUntil
    },

    pausedForMs() {
      return Math.max(0, pausedUntil - Date.now())
    },
  }
}