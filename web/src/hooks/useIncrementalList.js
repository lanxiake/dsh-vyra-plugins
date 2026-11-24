import { useEffect, useRef, useState } from 'react'

/**
 * 增量列表：只渲染第一批，末尾哨兵进入视口时追加下一批。
 * 移植自 dsh-plugin-hub `src/client/hooks/useIncrementalList.ts`（MIT）。
 */
const PAGE_SIZE = 100
const PRELOAD_MARGIN = '800px 0px'

export function useIncrementalList(items) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const sentinelRef = useRef(null)

  // 筛选 / 分类 / 搜索变化 → items 引用变化 → 窗口重置回首批
  useEffect(() => {
    setLimit(PAGE_SIZE)
  }, [items])

  useEffect(() => {
    const el = sentinelRef.current
    if (el === null || limit >= items.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLimit((current) => Math.min(current + PAGE_SIZE, items.length))
        }
      },
      { rootMargin: PRELOAD_MARGIN },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [limit, items.length])

  return { visible: items.slice(0, limit), sentinelRef, total: items.length }
}
