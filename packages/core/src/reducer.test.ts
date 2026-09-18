import { describe, expect, it } from 'vitest'
import { applyAgentEvent, applyAgentEvents, MAX_TEXT_ENTRY_LENGTH } from './reducer'
import type { AgentEvent } from './events'
import type { StreamEntry } from './entries'

describe('applyAgentEvent · 文本增量', () => {
  it('连续 text-delta 合并到同一条目', () => {
    let s: StreamEntry[] = []
    s = applyAgentEvent(s, { type: 'text-delta', text: '你好' })
    s = applyAgentEvent(s, { type: 'text-delta', text: '，世界' })
    expect(s).toEqual([{ kind: 'text', text: '你好，世界' }])
  })

  it('reasoning 与 text 交替时新建条目', () => {
    let s: StreamEntry[] = []
    s = applyAgentEvent(s, { type: 'reasoning-delta', text: '思考中' })
    s = applyAgentEvent(s, { type: 'text-delta', text: '回答' })
    s = applyAgentEvent(s, { type: 'reasoning-delta', text: '再想想' })
    expect(s.map(e => e.kind)).toEqual(['reasoning', 'text', 'reasoning'])
    expect(s[0]).toEqual({ kind: 'reasoning', text: '思考中' })
  })

  it('超长条目截尾保护', () => {
    let s: StreamEntry[] = []
    const chunk = 'a'.repeat(MAX_TEXT_ENTRY_LENGTH)
    s = applyAgentEvent(s, { type: 'text-delta', text: chunk })
    s = applyAgentEvent(s, { type: 'text-delta', text: 'TAIL' })
    const text = (s[0] as { text: string }).text
    expect(text.length).toBe(MAX_TEXT_ENTRY_LENGTH)
    expect(text.endsWith('TAIL')).toBe(true)
  })
})

describe('applyAgentEvent · 工具生命周期', () => {
  it('args 流式累积 → input settled 后清空 streamingArgs', () => {
    let s: StreamEntry[] = []
    s = applyAgentEvent(s, { type: 'tool-call-start', toolCallId: 't1', toolName: 'read' })
    s = applyAgentEvent(s, { type: 'tool-call-args-delta', toolCallId: 't1', argsText: '{"pa' })
    s = applyAgentEvent(s, { type: 'tool-call-args-delta', toolCallId: 't1', argsText: 'th":"a.ts"}' })
    let tool = s[0] as Extract<StreamEntry, { kind: 'tool' }>
    expect(tool.streamingArgs).toBe('{"path":"a.ts"}')
    s = applyAgentEvent(s, { type: 'tool-call-input', toolCallId: 't1', input: { path: 'a.ts' } })
    tool = s[0] as Extract<StreamEntry, { kind: 'tool' }>
    expect(tool.input).toEqual({ path: 'a.ts' })
    expect(tool.streamingArgs).toBeUndefined()
  })

  it('tool-output-delta 流式累积，tool-result 回填并清空流式与审批态', () => {
    let s: StreamEntry[] = []
    s = applyAgentEvent(s, { type: 'tool-call-start', toolCallId: 't1', toolName: 'bash' })
    s = applyAgentEvent(s, { type: 'approval-requested', toolCallId: 't1', level: 'confirm' })
    s = applyAgentEvent(s, { type: 'tool-output-delta', toolCallId: 't1', outputText: '$ ls\n' })
    s = applyAgentEvent(s, { type: 'tool-output-delta', toolCallId: 't1', outputText: 'src' })
    s = applyAgentEvent(s, { type: 'tool-result', toolCallId: 't1', output: { ok: 'success', stdout: 'src' } })
    const tool = s[0] as Extract<StreamEntry, { kind: 'tool' }>
    expect(tool.output).toEqual({ ok: 'success', stdout: 'src' })
    expect(tool.pendingApproval).toBeUndefined()
    expect(tool.streamingOutput).toBeUndefined()
  })

  it('多工具并行时按 toolCallId 精确回填', () => {
    let s: StreamEntry[] = []
    s = applyAgentEvent(s, { type: 'tool-call-start', toolCallId: 'a', toolName: 'read' })
    s = applyAgentEvent(s, { type: 'tool-call-start', toolCallId: 'b', toolName: 'glob' })
    s = applyAgentEvent(s, { type: 'tool-result', toolCallId: 'b', output: { ok: 'success' } })
    expect((s[0] as Extract<StreamEntry, { kind: 'tool' }>).output).toBeUndefined()
    expect((s[1] as Extract<StreamEntry, { kind: 'tool' }>).output).toEqual({ ok: 'success' })
  })

  it('start 丢失时按 toolName 容错匹配最近未完成条目', () => {
    let s: StreamEntry[] = []
    s = applyAgentEvent(s, { type: 'tool-call-start', toolCallId: 'a', toolName: 'read' })
    s = applyAgentEvent(s, { type: 'tool-result', toolCallId: 'lost', toolName: 'read', output: { ok: 'success' } })
    expect((s[0] as Extract<StreamEntry, { kind: 'tool' }>).output).toEqual({ ok: 'success' })
  })

  it('完全未知 id 的 result 被忽略', () => {
    let s: StreamEntry[] = [{ kind: 'text', text: 'hi' }]
    const next = applyAgentEvent(s, { type: 'tool-result', toolCallId: 'x', output: { ok: 'success' } })
    expect(next).toBe(s)
  })
})

describe('applyAgentEvent · 引用稳定性与杂项', () => {
  it('step-complete / turn-complete 返回原引用', () => {
    const s: StreamEntry[] = []
    expect(applyAgentEvent(s, { type: 'step-complete' })).toBe(s)
    expect(applyAgentEvent(s, { type: 'turn-complete', finishReason: 'stop' })).toBe(s)
  })

  it('error 事件生成 error 条目', () => {
    const s = applyAgentEvent([], { type: 'error', message: 'boom' })
    expect(s).toEqual([{ kind: 'error', text: 'boom' }])
  })

  it('applyAgentEvents 批量应用', () => {
    const script: AgentEvent[] = [
      { type: 'reasoning-delta', text: '想一想' },
      { type: 'text-delta', text: '结果' },
      { type: 'tool-call-start', toolCallId: 't', toolName: 'bash' },
      { type: 'tool-result', toolCallId: 't', output: { ok: 'error', error: 'exit 1' } },
      { type: 'turn-complete', finishReason: 'stop' },
    ]
    const s = applyAgentEvents([], script)
    expect(s.map(e => e.kind)).toEqual(['reasoning', 'text', 'tool'])
    expect((s[2] as Extract<StreamEntry, { kind: 'tool' }>).output).toEqual({ ok: 'error', error: 'exit 1' })
  })
})
