import { describe, expect, it, vi } from 'vitest'
import { jsonSchema, tool } from 'ai'
import type { LanguageModel, ToolSet } from 'ai'
import { createLoopAgent } from './agent'
import type { AgentEvent } from '../events'

/** 手写 mock LanguageModel：按调用序号播放剧本，并记录每次收到的 prompt。 */
function mockModel(scripts: Array<Array<Record<string, unknown>>>) {
  const prompts: unknown[] = []
  let call = 0
  const model = {
    specificationVersion: 'v3',
    provider: 'mock',
    modelId: 'mock-model',
    async doStream({ prompt }: { prompt: unknown }) {
      const script = scripts[Math.min(call, scripts.length - 1)] ?? []
      call++
      prompts.push(prompt)
      return {
        stream: new ReadableStream<Record<string, unknown>>({
          start(controller) {
            for (const part of script) controller.enqueue(part)
            controller.close()
          },
        }),
      }
    },
    async doGenerate() {
      throw new Error('generate not used in tests')
    },
  }
  return { model: model as unknown as LanguageModel, prompts }
}

const textStep = (text: string): Array<Record<string, unknown>> => [
  { type: 'text-start', id: 't0' },
  { type: 'text-delta', id: 't0', delta: text },
  { type: 'text-end', id: 't0' },
  { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 }, totalTokens: { total: 2 } } },
]

async function collect(gen: AsyncGenerator<AgentEvent>): Promise<AgentEvent[]> {
  const out: AgentEvent[] = []
  for await (const e of gen) out.push(e)
  return out
}

describe('createLoopAgent · fullStream → AgentEvent 翻译', () => {
  it('纯文本回合：text-delta / step-complete / turn-complete', async () => {
    const { model } = mockModel([
      [
        { type: 'text-start', id: 't0' },
        { type: 'text-delta', id: 't0', delta: '你' },
        { type: 'text-delta', id: 't0', delta: '好' },
        { type: 'text-end', id: 't0' },
        { type: 'reasoning-start', id: 'r0' },
        { type: 'reasoning-delta', id: 'r0', delta: '想一想' },
        { type: 'reasoning-end', id: 'r0' },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: '！' },
        { type: 'text-end', id: 't1' },
        { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 }, totalTokens: { total: 2 } } },
      ],
    ])
    const agent = createLoopAgent({ model })
    const events = await collect(agent.stream({ prompt: 'hi' }))
    const types = events.map(e => e.type)
    expect(types).toContain('reasoning-delta')
    expect(types).toContain('text-delta')
    expect(types).toContain('step-complete')
    expect(types[types.length - 1]).toBe('turn-complete')
    const finish = events[events.length - 1]
    expect(finish).toEqual({ type: 'turn-complete', finishReason: 'stop' })
    // text-delta 增量保序拼接
    const text = events.filter(e => e.type === 'text-delta').map(e => (e as { text: string }).text).join('')
    expect(text).toBe('你好！')
  })

  it('工具回合：tool-call → execute → tool-result（output 归一为 ok 约定）', async () => {
    const { model } = mockModel([
      [
        { type: 'tool-call', toolCallId: 't1', toolName: 'echo', input: JSON.stringify({ msg: 'hi' }) },
        { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 }, totalTokens: { total: 2 } } },
      ],
      textStep('done'),
    ])
    const executed: unknown[] = []
    const tools: ToolSet = {
      echo: tool({
        description: 'echo',
        inputSchema: jsonSchema<{ msg: string }>({ type: 'object', properties: { msg: { type: 'string' } } }),
        execute: async (args) => {
          executed.push(args)
          return { ok: 'success', echoed: args.msg }
        },
      }),
    }
    const agent = createLoopAgent({ model, tools })
    const events = await collect(agent.stream({ prompt: 'go' }))

    expect(executed).toEqual([{ msg: 'hi' }])
    const result = events.find(e => e.type === 'tool-result') as Extract<AgentEvent, { type: 'tool-result' }>
    expect(result.toolCallId).toBe('t1')
    expect(result.output).toEqual({ ok: 'success', echoed: 'hi' })
    // 非约定形状的输出会被包一层 ok:'success'
    expect(events[events.length - 1]).toEqual({ type: 'turn-complete', finishReason: 'stop' })
  })

  it('非约定输出被包裹为 {ok:"success", value}', async () => {
    const { model } = mockModel([
      [
        { type: 'tool-call', toolCallId: 't9', toolName: 'raw', input: '{}' },
        { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 }, totalTokens: { total: 2 } } },
      ],
      textStep('ok'),
    ])
    const tools: ToolSet = {
      raw: tool({
        inputSchema: jsonSchema<{ }>({ type: 'object' }),
        execute: async () => 'plain string output',
      }),
    }
    const agent = createLoopAgent({ model, tools })
    const events = await collect(agent.stream({ prompt: 'go' }))
    const result = events.find(e => e.type === 'tool-result') as Extract<AgentEvent, { type: 'tool-result' }>
    expect(result.output).toEqual({ ok: 'success', value: 'plain string output' })
  })
})

describe('createLoopAgent · HITL 挂起桥', () => {
  it('waitForUser 挂起 → resolveUser 回流 → 工具结果继续', async () => {
    const { model } = mockModel([
      [
        { type: 'tool-call', toolCallId: 'ask1', toolName: 'ask_user', input: '{"q":"选哪个"}' },
        { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 }, totalTokens: { total: 2 } } },
      ],
      textStep('收到你的选择'),
    ])
    const tools: ToolSet = {
      ask_user: tool({
        inputSchema: jsonSchema<{ q: string }>({ type: 'object', properties: { q: { type: 'string' } } }),
        execute: async () => createLoopAgentHolder.agent!.waitForUser(),
      }),
    }
    // 间接引用：execute 闭包里拿到 agent 实例
    const holder = createLoopAgentHolder
    holder.agent = createLoopAgent({ model, tools })

    const run = collect(holder.agent.stream({ prompt: 'go' }))
    await vi.waitFor(() => expect(holder.agent!.userPending).toBe(true))
    expect(holder.agent!.resolveUser({ ok: 'success', answer: 'B' })).toBe(true)
    const events = await run

    const result = events.find(e => e.type === 'tool-result') as Extract<AgentEvent, { type: 'tool-result' }>
    expect(result.output).toEqual({ ok: 'success', answer: 'B' })
    expect(holder.agent!.userPending).toBe(false)
    expect(holder.agent!.resolveUser({})).toBe(false) // 无等待者
  })
})

describe('createLoopAgent · 图片回注（prepareStep）', () => {
  it('工具产出图片在下一步作为 user file part 注入模型', async () => {
    const { model, prompts } = mockModel([
      [
        { type: 'tool-call', toolCallId: 'render', toolName: 'render', input: '{}' },
        { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 }, totalTokens: { total: 2 } } },
      ],
      textStep('图已收到'),
    ])
    const tools: ToolSet = {
      render: tool({
        inputSchema: jsonSchema<{ }>({ type: 'object' }),
        execute: async () => {
          createLoopAgentHolder.agent!.enqueueImage({ data: 'aGVsbG8=', mediaType: 'image/png' })
          return { ok: 'success' }
        },
      }),
    }
    const holder = createLoopAgentHolder
    holder.agent = createLoopAgent({ model, tools })
    const events = await collect(holder.agent.stream({ prompt: 'go' }))

    expect(events.some(e => e.type === 'text-delta')).toBe(true)
    // 第二步的 prompt（V4 消息数组）末尾应有 user 消息携带 file part
    expect(prompts.length).toBe(2)
    const second = prompts[1] as Array<{ role: string; content: Array<Record<string, unknown>> | string }>
    const lastMsg = second[second.length - 1]!
    expect(lastMsg.role).toBe('user')
    const parts = Array.isArray(lastMsg.content) ? lastMsg.content : []
    expect(parts.some(p => p.type === 'file' && p.mediaType === 'image/png')).toBe(true)
  })
})

// 测试用的 agent 间接引用（execute 闭包不能直接引用正在创建的 agent）
const createLoopAgentHolder: { agent: ReturnType<typeof createLoopAgent> | null } = { agent: null }
