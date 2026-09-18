import { describe, expect, it } from 'vitest'
import { applyAgentEvents } from './reducer'
import { findPendingTool, hasPendingTool } from './selectors'
import type { AgentEvent } from './events'

const script = (over: AgentEvent[] = []): AgentEvent[] => [
  { type: 'text-delta', text: 'hi' },
  { type: 'tool-call-start', toolCallId: 'a', toolName: 'ask_questions' },
  { type: 'tool-call-input', toolCallId: 'a', input: { questions: [] } },
  ...over,
]

describe('findPendingTool（宿主 UI 联动机制 B）', () => {
  it('入参完整且结果未到 → 挂起中，可被宿主接管', () => {
    const entries = applyAgentEvents([], script())
    const pending = findPendingTool(entries, 'ask_questions')
    expect(pending?.toolCallId).toBe('a')
    expect(pending?.input).toEqual({ questions: [] })
  })

  it('结果到达后不再是挂起中（变形该退场）', () => {
    const entries = applyAgentEvents([], script([
      { type: 'tool-result', toolCallId: 'a', output: { ok: 'success' } },
    ]))
    expect(findPendingTool(entries, 'ask_questions')).toBeUndefined()
  })

  it('参数仍在流式（input 未 settled）不算挂起——practi 的防抖判据', () => {
    const entries = applyAgentEvents([], [
      { type: 'tool-call-start', toolCallId: 'b', toolName: 'ask_questions' },
      { type: 'tool-call-args-delta', toolCallId: 'b', argsText: '{"que' },
    ])
    expect(findPendingTool(entries, 'ask_questions')).toBeUndefined()
  })

  it('按工具名过滤，其他工具挂起不影响', () => {
    const entries = applyAgentEvents([], [
      { type: 'tool-call-start', toolCallId: 'c', toolName: 'bash' },
      { type: 'tool-call-input', toolCallId: 'c', input: { command: 'ls' } },
    ])
    expect(findPendingTool(entries, 'ask_questions')).toBeUndefined()
    expect(hasPendingTool(entries)).toBe(true)
  })
})
