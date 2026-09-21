/**
 * applyAgentEvent — AgentEvent → StreamEntry[] 的归并 reducer（纯函数）。
 *
 * 提纯自 okoknit 的 pushEvent（App.tsx 内联 reducer），吸收 practi 的
 * streamEntries 维护规则：
 * - text/reasoning 增量合并到上一条同类条目，只增不截——截头会把展开态里
 *   已显示的行弄丢（2026-09-21 tut 实测）；
 * - 工具事件按 toolCallId 精确回填；start 丢失时按 toolName 容错匹配
 *   最近一条未完成的工具条目（okoknit 模式）；
 * - 不改变条目的事件（step-complete/turn-complete）返回原数组引用，
 *   让 React 的 useReducer 跳过无谓重渲。
 */

import type { AgentEvent } from './events'
import type { StreamEntry, ToolEntry } from './entries'

/** 单条工具流式输出的最大保留长度（截尾，okoknit 取 8000）；文本/思考条目不截断。 */
export const MAX_TEXT_ENTRY_LENGTH = 8000

function appendChunk(
  entries: StreamEntry[],
  kind: 'text' | 'reasoning',
  chunk: string,
): StreamEntry[] {
  const last = entries[entries.length - 1]
  if (last !== undefined && last.kind === kind) {
    const next = [...entries]
    next[entries.length - 1] = { kind, text: last.text + chunk }
    return next
  }
  return [...entries, { kind, text: chunk }]
}

/** 按 id 精确查找；失败时按 toolName 容错匹配最近一条未完成的工具条目。 */
function findToolIndex(entries: StreamEntry[], toolCallId: string, toolName?: string): number {
  const byId = entries.findIndex(e => e.kind === 'tool' && e.toolCallId === toolCallId)
  if (byId !== -1) return byId
  if (toolName === undefined) return -1
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]
    if (e !== undefined && e.kind === 'tool' && e.toolName === toolName && e.output === undefined) return i
  }
  return -1
}

function updateTool(entries: StreamEntry[], toolCallId: string, toolName: string | undefined, patch: (t: ToolEntry) => ToolEntry): StreamEntry[] {
  const idx = findToolIndex(entries, toolCallId, toolName)
  if (idx === -1) return entries
  const next = [...entries]
  const target = next[idx]
  if (target === undefined || target.kind !== 'tool') return entries
  next[idx] = patch(target)
  return next
}

export function applyAgentEvent(entries: StreamEntry[], event: AgentEvent): StreamEntry[] {
  switch (event.type) {
    case 'reasoning-delta':
      return appendChunk(entries, 'reasoning', event.text)
    case 'text-delta':
      return appendChunk(entries, 'text', event.text)
    case 'tool-call-start':
      return [...entries, {
        kind: 'tool',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
      }]
    case 'tool-call-args-delta':
      return updateTool(entries, event.toolCallId, undefined, t => ({
        ...t,
        streamingArgs: (t.streamingArgs ?? '') + event.argsText,
      }))
    case 'tool-call-input':
      return updateTool(entries, event.toolCallId, undefined, t => ({
        ...t,
        input: event.input,
        streamingArgs: undefined,
      }))
    case 'tool-output-delta':
      return updateTool(entries, event.toolCallId, undefined, t => ({
        ...t,
        streamingOutput: ((t.streamingOutput ?? '') + event.outputText).slice(-MAX_TEXT_ENTRY_LENGTH),
      }))
    case 'approval-requested':
      return updateTool(entries, event.toolCallId, undefined, t => ({
        ...t,
        pendingApproval: { level: event.level, args: event.args },
      }))
    case 'tool-result':
      return updateTool(entries, event.toolCallId, event.toolName, t => ({
        ...t,
        output: event.output,
        pendingApproval: undefined,
        streamingOutput: undefined,
      }))
    case 'error':
      return [...entries, { kind: 'error', text: event.message }]
    case 'step-complete':
    case 'turn-complete':
      return entries
  }
}

export function applyAgentEvents(entries: StreamEntry[], events: Iterable<AgentEvent>): StreamEntry[] {
  let acc = entries
  for (const e of events) acc = applyAgentEvent(acc, e)
  return acc
}
