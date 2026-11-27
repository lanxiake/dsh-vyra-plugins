// 发货内容闸门：纯函数，不依赖 IO。
//
// 2026-11-27 的事故：生成型卡券把「暂无法生成（分享链接生成工具未就绪）」原样发给了买家。
// 这里把它和同类占位文案、网盘厂商广告一律判为不可发货。
// 规则来源：docs/superpowers/specs/2026-11-27-xianyu-notify-netdisk-design.md §5.1

export const PLACEHOLDER_WORDS = [
  '待生成', '待补发', '暂无法', '无法生成', '生成失败', '稍后补发',
  '提取码：无', '提取码:无', '未就绪',
]

export const AD_WORDS = ['SVIP', '开通', '去升级', 'uptoken']

const QUARK_LINK = /https:\/\/pan\.quark\.cn\/s\/[0-9a-zA-Z]{6,20}/g
// 百度分享的链接后面会跟 `?pwd=`，所以这里只取路径部分。
const BAIDU_LINK = /https:\/\/pan\.baidu\.com\/s\/[0-9a-zA-Z_-]+/g
// 提取码可能写在正文，也可能直接拼在链接后面（?pwd=xxxx）。
// 链接正则按 spec 只取到 s/<id>，所以这里用更宽的匹配判断是否自带 pwd。
const PWD_IN_TEXT = /pan\.(?:quark|baidu)\.(?:cn|com)\/\S*[?&]pwd=[0-9a-zA-Z]{4}/
const PASSCODE_TEXT = /提取码[：:]\s*([0-9a-zA-Z]{4})/
const EXPIRY = /(\d+)\s*天/

/**
 * 校验一段准备发给买家的发货内容。
 *
 * mode：
 *   'link'（默认，网盘商品）—— 必须有可访问的分享链接 + 提取码；
 *   'code'（卡密/激活码）   —— 只要求非空，且不含占位文案与广告。
 * 两种模式都会拦占位词（2026-11-27 事故的根因）与厂商广告。
 *
 * @param {string} text 发货正文
 * @param {{ provider?: 'quark'|'baidu', expireDays?: number, mode?: 'link'|'code' }} options
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateDelivery(text, { provider = 'quark', expireDays = 7, mode = 'link' } = {}) {
  const body = String(text ?? '')
  const errors = []
  const wantLink = mode !== 'code'

  // 1. 基础链接（卡密模式不要求）
  const pattern = provider === 'baidu' ? BAIDU_LINK : QUARK_LINK
  const links = body.match(pattern) || []
  if (wantLink && links.length === 0) errors.push('link:missing')

  // 2. 提取码：链接自带 pwd 时可以省略正文里的提取码
  const hasPwdInUrl = PWD_IN_TEXT.test(body)
  if (wantLink && links.length > 0 && !hasPwdInUrl && !PASSCODE_TEXT.test(body)) {
    errors.push('passcode:missing')
  }
  // 卡密模式也不许把「提取码：<空>」这种半截话发出去
  if (!wantLink && PASSCODE_TEXT.test(body) === false && /提取码/.test(body)) {
    errors.push('passcode:missing')
  }

  // 3. 占位词与广告词
  for (const word of PLACEHOLDER_WORDS) {
    if (body.includes(word)) errors.push(`placeholder:${word}`)
  }
  for (const word of AD_WORDS) {
    if (body.includes(word)) errors.push(`ad:${word}`)
  }

  // 4. 有效期声明与配置一致（没写有效期视为未声明，不判错）
  const expiry = body.match(EXPIRY)
  if (expiry && Number(expiry[1]) !== Number(expireDays)) errors.push('expiry:mismatch')

  // 5. 内容不能为空
  if (!body.trim()) errors.push('empty')

  return { ok: errors.length === 0, errors }
}

/** 卡券类型/模式决定用哪套校验：网盘类走 link，卡密类走 code。 */
export function validationModeFor(card) {
  if (!card) return 'link'
  if (card.type === 'text' || card.type === 'image') return 'code'
  if (card.mode === 'generate') return 'link'
  // 池型/复用型：内容里出现分享链接就按网盘链接严检，否则按卡密。
  return /pan\.(quark|baidu)\.(cn|com)\/s\//.test(String(card.content || '')) ? 'link' : 'code'
}
