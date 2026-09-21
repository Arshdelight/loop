import { describe, expect, it, vi } from 'vitest'
import { jsonSchema, tool } from 'ai'
import type { LanguageModel, ToolSet } from 'ai'
import { createLoopAgent } from './agent'
import type { AgentEvent } from '../events'

type MockScript =
  | Array<Record<string, unknown>>
  | { parts: Array<Record<string, unknown>>; keepOpen?: boolean }

/** 手写 mock LanguageModel：按调用序号播放剧本，并记录每次收到的 prompt。 */
function mockModel(scripts: Array<MockScript>) {
  const prompts: unknown[] = []
  let call = 0
  const model = {
    specificationVersion: 'v3',
    provider: 'mock',
    modelId: 'mock-model',
    async doStream({ prompt, abortSignal }: { prompt: unknown; abortSignal?: AbortSignal }) {
      const raw = scripts[Math.min(call, scripts.length - 1)] ?? []
      const script = Array.isArray(raw) ? raw : raw.parts
      const keepOpen = !Array.isArray(raw) && raw.keepOpen === true
      call++
      prompts.push(prompt)
      return {
        stream: new ReadableStream<Record<string, unknown>>({
          start(controller) {
            for (const part of script) controller.enqueue(part)
            if (keepOpen && abortSignal) {
              // 模拟真实 provider：请求被中止时底层流以 AbortError 中断
              // （SDK 据此产出 fullStream 的 abort part），剧本播完不主动关闭
              abortSignal.addEventListener(
                'abort',
                () => controller.error(new DOMException('This operation was aborted', 'AbortError')),
                { once: true },
              )
              return
            }
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
    expect(finish).toEqual({ type: 'turn-complete', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } })
    // text-delta 增量保序拼接
    const text = events.filter(e => e.type === 'text-delta').map(e => (e as { text: string }).text).join('')
    expect(text).toBe('你好！')
  })

  it('turn-complete.usage：finish 的 usage 映射为回合累计用量', async () => {
    const { model } = mockModel([
      [
        { type: 'text-start', id: 't0' },
        { type: 'text-delta', id: 't0', delta: '好' },
        { type: 'text-end', id: 't0' },
        { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: { inputTokens: { total: 10 }, outputTokens: { total: 5 }, totalTokens: { total: 15 } } },
      ],
    ])
    const agent = createLoopAgent({ model })
    const events = await collect(agent.stream({ prompt: 'hi' }))
    const finish = events[events.length - 1] as Extract<AgentEvent, { type: 'turn-complete' }>
    expect(finish.finishReason).toBe('stop')
    expect(finish.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 })
  })

  it('provider 未上报 token 数（usage 空对象）→ turn-complete.usage 缺省', async () => {
    const { model } = mockModel([
      [
        { type: 'text-start', id: 't0' },
        { type: 'text-delta', id: 't0', delta: '好' },
        { type: 'text-end', id: 't0' },
        { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: { inputTokens: {}, outputTokens: {} } },
      ],
    ])
    const agent = createLoopAgent({ model })
    const events = await collect(agent.stream({ prompt: 'hi' }))
    const finish = events[events.length - 1] as Extract<AgentEvent, { type: 'turn-complete' }>
    expect(finish.finishReason).toBe('stop')
    expect(finish.usage).toBeUndefined()
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
    // 非约定形状的输出会被包一层 ok:'success'；usage 为两步累计
    expect(events[events.length - 1]).toEqual({ type: 'turn-complete', finishReason: 'stop', usage: { inputTokens: 2, outputTokens: 2, totalTokens: 4 } })
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

describe('createLoopAgent · 中止/出错收尾的在途工具补发', () => {
  it('abort 收尾：在途工具先按 start 顺序补发 tool-result {ok:"aborted"}，再发 turn-complete(aborted)', async () => {
    const controller = new AbortController()
    // keepOpen：start 已发出、input 未闭合、结果未到——中止时的在途悬置态
    const { model } = mockModel([
      { parts: [
        { type: 'tool-input-start', id: 'c1', toolName: 'echo' },
        { type: 'tool-input-delta', id: 'c1', delta: '{"msg"' },
        { type: 'tool-input-start', id: 'c2', toolName: 'other' },
      ], keepOpen: true },
    ])
    const agent = createLoopAgent({ model })
    const events: AgentEvent[] = []
    // 消费到两个 start 都到达后中止（模拟宿主在工具在途时按停止），继续排干到流结束
    for await (const event of agent.stream({ prompt: 'go', abortSignal: controller.signal })) {
      events.push(event)
      if (events.filter(e => e.type === 'tool-call-start').length === 2) controller.abort()
    }
    expect(events[events.length - 1]).toEqual({ type: 'turn-complete', finishReason: 'aborted' })
    // turn-complete 之前是按 start 顺序补发的两条合成结果
    expect(events.slice(-3, -1)).toEqual([
      { type: 'tool-result', toolCallId: 'c1', toolName: 'echo', output: { ok: 'aborted' } },
      { type: 'tool-result', toolCallId: 'c2', toolName: 'other', output: { ok: 'aborted' } },
    ])
  })

  it('已拿到结果（真实 result / tool-error）的调用不补发，只补发中止时的在途调用', async () => {
    const controller = new AbortController()
    // 第一步：fine 正常完成、bad 执行报错；第二步：hang 开始后回合并被中止
    const { model } = mockModel([
      [
        { type: 'tool-call', toolCallId: 'a', toolName: 'fine', input: '{}' },
        { type: 'tool-call', toolCallId: 'b', toolName: 'bad', input: '{}' },
        { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 }, totalTokens: { total: 2 } } },
      ],
      { parts: [{ type: 'tool-input-start', id: 'c', toolName: 'hang' }], keepOpen: true },
    ])
    const tools: ToolSet = {
      fine: tool({
        inputSchema: jsonSchema<{}>({ type: 'object' }),
        execute: async () => ({ ok: 'success' }),
      }),
      bad: tool({
        inputSchema: jsonSchema<{}>({ type: 'object' }),
        // 标注返回类型：裸 throw 箭头函数推断为 Promise<never>，
        // SDK tool() 的重载对 OUTPUT=never 解析失败
        execute: async (): Promise<{ ok: 'error' }> => {
          throw new Error('boom')
        },
      }),
      hang: tool({
        inputSchema: jsonSchema<{}>({ type: 'object' }),
        execute: async () => new Promise(() => {}),
      }),
    }
    const agent = createLoopAgent({ model, tools })
    const events: AgentEvent[] = []
    for await (const event of agent.stream({ prompt: 'go', abortSignal: controller.signal })) {
      events.push(event)
      if (event.type === 'tool-call-start' && event.toolCallId === 'c') controller.abort()
    }
    // 全回合三条结果：两条真实（success / error 归一），一条合成补发
    // （两条真实结果并发执行，到达顺序不保证，按 toolCallId 排序后比对）
    const results = (events.filter(e => e.type === 'tool-result') as Array<Extract<AgentEvent, { type: 'tool-result' }>>)
      .sort((x, y) => x.toolCallId.localeCompare(y.toolCallId))
    expect(results).toEqual([
      { type: 'tool-result', toolCallId: 'a', toolName: 'fine', output: { ok: 'success' } },
      { type: 'tool-result', toolCallId: 'b', toolName: 'bad', output: { ok: 'error', error: 'boom' } },
      { type: 'tool-result', toolCallId: 'c', toolName: 'hang', output: { ok: 'aborted' } },
    ])
    expect(events[events.length - 1]).toEqual({ type: 'turn-complete', finishReason: 'aborted' })
  })

  it('error 收尾：在途调用补发 {ok:"aborted"}，随后是 error 事件', async () => {
    const { model } = mockModel([
      [
        { type: 'tool-input-start', id: 'c1', toolName: 'echo' },
        { type: 'error', error: new Error('provider 500') },
      ],
    ])
    const agent = createLoopAgent({ model })
    const events = await collect(agent.stream({ prompt: 'go' }))
    const last = events[events.length - 1] as Extract<AgentEvent, { type: 'turn-complete' } | { type: 'error' }>
    expect(last.type === 'error' || last.finishReason === 'error').toBe(true)
    const flushIndex = events.findIndex(e => e.type === 'tool-result' && (e as Extract<AgentEvent, { type: 'tool-result' }>).output.ok === 'aborted')
    const errorIndex = events.findIndex(e => e.type === 'error')
    expect(flushIndex).toBeGreaterThan(-1)
    expect(errorIndex).toBeGreaterThan(flushIndex)
    const flushed = events[flushIndex] as Extract<AgentEvent, { type: 'tool-result' }>
    expect(flushed).toEqual({ type: 'tool-result', toolCallId: 'c1', toolName: 'echo', output: { ok: 'aborted' } })
  })

  it('多回合互不影响：每回合只补发本回合的在途调用', async () => {
    const { model } = mockModel([
      { parts: [{ type: 'tool-input-start', id: 'r1', toolName: 'echo' }], keepOpen: true },
      { parts: [{ type: 'tool-input-start', id: 'r2', toolName: 'echo' }], keepOpen: true },
    ])
    const agent = createLoopAgent({ model })
    const syntheticIds = (events: AgentEvent[]) =>
      (events.filter(e => e.type === 'tool-result') as Array<Extract<AgentEvent, { type: 'tool-result' }>>)
        .filter(e => e.output.ok === 'aborted')
        .map(e => e.toolCallId)
    const run = async (prompt: string) => {
      const controller = new AbortController()
      const events: AgentEvent[] = []
      for await (const event of agent.stream({ prompt, abortSignal: controller.signal })) {
        events.push(event)
        if (event.type === 'tool-call-start') controller.abort()
      }
      return events
    }
    expect(syntheticIds(await run('one'))).toEqual(['r1'])
    expect(syntheticIds(await run('two'))).toEqual(['r2'])
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
