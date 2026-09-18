import { describe, expect, it } from 'vitest'
import { appendAssistantTurn } from './history'

describe('appendAssistantTurn', () => {
  it('工具回合：assistant(text+tool-call) 后紧跟 tool(tool-result)', () => {
    const messages = appendAssistantTurn([{ role: 'user', content: '北京多少度？' }], {
      text: '查一下天气',
      toolCalls: [{ toolCallId: 'c1', toolName: 'weather', input: { city: '北京' } }],
      toolResults: new Map([['c1', { ok: 'success', tempC: 23 }]]),
    })
    expect(messages).toHaveLength(3)
    expect(messages[1]).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: '查一下天气' },
        { type: 'tool-call', toolCallId: 'c1', toolName: 'weather', input: { city: '北京' } },
      ],
    })
    expect(messages[2]).toEqual({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'c1',
          toolName: 'weather',
          output: { type: 'json', value: { ok: 'success', tempC: 23 } },
        },
      ],
    })
  })

  it('没结果的调用整对丢弃，不留悬空 tool-call', () => {
    const messages = appendAssistantTurn([], {
      toolCalls: [
        { toolCallId: 'c1', toolName: 'ok_tool', input: {} },
        { toolCallId: 'c2', toolName: 'lost_tool', input: {} },
      ],
      toolResults: new Map([['c1', { ok: 'success' }]]),
    })
    expect(messages).toHaveLength(2)
    const assistant = messages[0] as { content: Array<{ type: string; toolCallId?: string }> }
    const tool = messages[1] as { content: Array<{ type: string; toolCallId?: string }> }
    expect(assistant.content.map(p => p.toolCallId)).toEqual(['c1'])
    expect(tool.content.map(p => p.toolCallId)).toEqual(['c1'])
  })

  it('纯文本回合：单条 assistant 消息', () => {
    const messages = appendAssistantTurn([], { text: '你好', toolCalls: [], toolResults: new Map() })
    expect(messages).toEqual([{ role: 'assistant', content: [{ type: 'text', text: '你好' }] }])
  })

  it('空回合：原数组原样返回（引用相等）', () => {
    const prev = [{ role: 'user' as const, content: 'hi' }]
    expect(appendAssistantTurn(prev, { toolCalls: [], toolResults: new Map() })).toBe(prev)
  })

  it('纯函数：不修改传入数组', () => {
    const prev = [{ role: 'user' as const, content: 'hi' }]
    appendAssistantTurn(prev, { text: '回', toolCalls: [], toolResults: new Map() })
    expect(prev).toHaveLength(1)
  })
})
