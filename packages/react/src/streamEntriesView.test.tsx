import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { applyAgentEvent, type AgentEvent, type StreamEntry } from '@arshdelight/loop-core'
import { ReasoningBlock } from './toolRegistry'

type ReasoningDelta = Extract<AgentEvent, { type: 'reasoning-delta' }>

/** renderToStaticMarkup 输出去掉标签与注释，只留文本。 */
function renderText(node: React.ReactNode): string {
  return renderToStaticMarkup(node)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, '')
}

describe('ReasoningBlock · 展开态流式渲染只增不减', () => {
  // 下游实测症状：思考条目展开后，随流式增量到达，已显示的行一行行消失。
  // 复现路径 = tut 的产品路径：reasoning-delta 事件流经 core reducer 折叠成
  // entry.text，再交给 ReasoningBlock 展开态渲染（StreamEntriesView 传给它的
  // 就是这两个 props；展开态用 defaultExpanded 等价模拟，SSR 无法点击按钮）。
  it('流式增量累计超过 8000 字符后，已显示内容不丢', () => {
    // 每行 ~46 字符 × 220 行 ≈ 1 万字符，越过 MAX_TEXT_ENTRY_LENGTH(8000)。
    const lines = Array.from({ length: 220 }, (_, i) =>
      `thinking line ${String(i).padStart(4, '0')} — aaaaaaaaaaaaaaaaaaaaaaaaaa`)
    const events: ReasoningDelta[] = lines.map(text => ({ type: 'reasoning-delta', text: `${text}\n` }))

    let entries: StreamEntry[] = []
    let accumulated = ''
    for (const event of events) {
      entries = applyAgentEvent(entries, event)
      accumulated += `${event.text}`
      const entry = entries[entries.length - 1]
      if (entry?.kind !== 'reasoning') throw new Error('期望折叠出 reasoning 条目')
      // 数据层不变式：entry.text 单调增长且完整。
      expect(entry.text).toBe(accumulated)
      // 渲染层不变式：展开态输出包含全部已累计文本（一行都不能少）。
      expect(renderText(
        <ReasoningBlock content={entry.text} defaultExpanded running />,
      )).toContain(accumulated)
    }
  })
})
