/**
 * DSH Plugin Hub — the community plugin marketplace for DeepSeek Harness.
 * Website: https://dsh-plugin.org
 * GitHub: https://github.com/dshplugin/dsh-plugin-hub
 *
 * 增量列表：只渲染（可能很大的）结果集的第一批，末尾哨兵滚入视口时就追加下一批，
 * 让插件市场绝不一次性挂载成千上万张卡片。
 * items 引用即列表身份 —— 分类/搜索/排序变化会产出新数组，窗口随之重置回第一批。
 */
import { useEffect, useRef, useState } from 'react'

/** 首批渲染条数 & 每次滚到底追加的增量（单卡约 80px 高，100 条已远超一屏） */
const PAGE_SIZE = 100
/** 哨兵进入视口底部前 800px 就提前加载下一批，滚到底时无感知衔接 */
const PRELOAD_MARGIN = '800px 0px'

export function useIncrementalList<T>(items: T[]) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // 筛选/分类/排序变化 → items 引用变化 → 窗口重置回首批
  useEffect(() => {
    setLimit(PAGE_SIZE)
  }, [items])

  // 哨兵进入视口（含预加载区）→ 追加下一批；已全部渲染则不再观察
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || limit >= items.length) return
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setLimit((cur) => Math.min(cur + PAGE_SIZE, items.length))
      }
    }, { rootMargin: PRELOAD_MARGIN })
    io.observe(el)
    return () => io.disconnect()
  }, [items.length, limit])

  return {
    shown: items.slice(0, limit),
    hasMore: limit < items.length,
    sentinelRef,
  }
}
