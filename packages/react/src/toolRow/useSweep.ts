import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * 固定线速度的扫光：动画时长随行内容宽度换算，使光带移动速度恒定（px/s），
 * 与行长短无关——keyframes 的 90% 时刻抵达内容末端，末 10% 停顿一拍。
 * 行宽变化（流式摘要增长、窗口缩放）由 ResizeObserver 自动重算。
 */
export const SWEEP_SPEED_PX_PER_SEC = 180
const SWEEP_BAND_WIDTH = 56

/** 返回该元素应有的扫光动画时长（css 字符串），挂在 --sweep-duration 上。 */
export function useSweepDuration(ref: RefObject<HTMLElement | null>): string {
  const [duration, setDuration] = useState('2.6s')
  useLayoutEffect(() => {
    const el = ref.current
    if (el === null) return
    const measure = () => {
      const dist = el.getBoundingClientRect().width + SWEEP_BAND_WIDTH
      const seconds = dist / (0.9 * SWEEP_SPEED_PX_PER_SEC)
      setDuration(`${seconds.toFixed(2)}s`)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return duration
}
