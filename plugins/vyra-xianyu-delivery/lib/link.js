// 链接策略：把一个网盘路径变成一段可以发给买家的文字。
//
// 两种策略：
//   reuse（默认）—— 同一商品复用一条未过期的分享。weflow.zip 有 260MB，
//                    每单新链接会被买家逐个转存，网盘空间随订单量膨胀。
//   fresh        —— 每单新建一条，适合「每人一条」的场景。
//
// 任何一步失败都抛错，由 dispatch 映射成 blocked + 待人工 + 通知，绝不返回半截文案。

const DAY = 86400000

function fail(code, message) {
  const err = new Error(message ? `${code}:${message}` : code)
  err.code = code
  return err
}

export function createLinkService({ store, netdisk, account = () => '', logger = () => {}, verify = true }) {
  const accountId = () => String(account() || '')

  async function build(text, share, expireDays) {
    return {
      text: `链接：${share.share_url}\n提取码：${share.passcode || ''}\n有效期 ${expireDays} 天`.replace(
        '提取码：\n', '',
      ),
      share,
    }
  }

  return {
    /**
     * @param {{ itemId: string, specValue?: string, path: string,
     *           strategy?: 'reuse'|'fresh', expireDays?: number, orderNo?: string }} args
     * @returns {Promise<{ text: string, share: object }>}
     */
    async obtain({ itemId, specValue = '', path, strategy = 'reuse', expireDays = 7, orderNo = '' }) {
      const days = Number(expireDays) || 7
      if (!String(path || '').trim()) throw fail('path_required')

      if (strategy === 'reuse') {
        const cached = store.lastShare({ itemId: String(itemId), provider: netdisk.id || 'quark' })
        if (cached) {
          logger(`reuse share ${cached.share_url} for ${itemId}`)
          return build('', {
            share_url: cached.share_url,
            passcode: cached.passcode,
            url_type: cached.url_type,
          }, days)
        }
      }

      const target = await netdisk.resolve(String(path).replace(/\\/g, '/'))
      const share = await netdisk.share({
        fid: target.fid,
        title: String(itemId || 'Xianyu'),
        expireDays: days,
      })

      if (verify) {
        const check = await netdisk.verify({ shareUrl: share.share_url, passcode: share.passcode })
        if (!check?.ok) {
          throw fail('verify_failed', check?.error || `status_${check?.status ?? 0}`)
        }
      }

      store.addShare({
        accountId: accountId(),
        provider: netdisk.id || 'quark',
        itemId: String(itemId || ''),
        specValue: String(specValue || ''),
        sourcePath: String(path),
        fid: target.fid,
        shareUrl: share.share_url,
        passcode: share.passcode,
        urlType: share.url_type ?? 2,
        expiredAt: new Date(Date.now() + days * DAY).toISOString(),
        strategy,
        orderNo: String(orderNo || ''),
        verified: verify ? 1 : 0,
      })

      return build('', share, days)
    },
  }
}
