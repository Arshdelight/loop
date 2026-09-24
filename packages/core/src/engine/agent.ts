/**
 * createLoopAgent —— 默认引擎（2026-09-18 路线图「导演组」）。
 *
 * AI SDK v7 ToolLoopAgent 的薄封装：把 fullStream 的 parts 翻译成 loop 的
 * AgentEvent 协议（引擎无关的公共语言），UI 层只认协议不认引擎。附带的
 * 两个横切能力：
 * - HITL 挂起桥（UserBridge）：ask 类工具 execute 里 await waitForUser()，
 *   宿主 findPendingTool 找到挂起行、resolveUser(output) 回流；
 * - 图片回注（prepareStep）：工具产出的图片在下一步前作为 user 消息追加
 *   （三家上游各自踩过的「tool 消息只收字符串」坑的统一解法）。
 *
 * 复杂引擎（如 practi 自研 loop）是「基于 loop 构建」的下游：实现同一套
 * AgentEvent 即可复用整个渲染层。
 */

import { ToolLoopAgent, isStepCount } from 'ai'
import type { LanguageModel, ModelMessage, ToolSet } from 'ai'
import type { AgentEvent, FinishReason, ToolOutput, TurnUsage } from '../events'
import { createUserBridge, type UserBridge } from './hitl'
import { drainImages, enqueueImage, type LoopImagePart } from './imageQueue'

export interface LoopAgentOptions {
  model: LanguageModel
  instructions?: string
  tools?: ToolSet
  /** 最大步数，默认 20（与 AI SDK 默认一致）。 */
  maxSteps?: number
  /** 工具产出图片回注模型（prepareStep 注入 user 消息），默认开启。 */
  imageLoopback?: boolean
}

export interface LoopAgentStreamInput {
  prompt?: string | Array<ModelMessage>
  /**
   * 多轮历史。必须遵循 assistant(tool-call) + tool(tool-result) 成对约定：
   * 工具结果放独立的 role:'tool' 消息、不留悬空调用，否则 AI SDK 提示词
   * 转换抛 AI_MissingToolResultsError。见 README「多轮对话历史约定」与
   * appendAssistantTurn 辅助函数。
   */
  messages?: Array<ModelMessage>
  abortSignal?: AbortSignal
}

export interface LoopAgent {
  /** 流式运行一回合，产出 AgentEvent（async iterable，可直接进 reducer）。 */
  stream(input: LoopAgentStreamInput): AsyncGenerator<AgentEvent>
  /** HITL：工具 execute 内挂起等待用户输入（单槽）。 */
  waitForUser<T = unknown>(): Promise<T>
  /** HITL：宿主提交答案，唤醒挂起的工具。无等待者时返回 false。 */
  resolveUser(value: unknown): boolean
  /** HITL：放弃等待（等待者收到 undefined）。 */
  abandonUser(): void
  /** 当前是否有挂起中的用户等待。 */
  readonly userPending: boolean
  /** 多模态：工具产出图片入队（下一步前回注模型）。 */
  enqueueImage(image: LoopImagePart): void
  /** 原生 ToolLoopAgent 逃生口（generate / 结构化输出等高级能力直连）。 */
  readonly raw: ToolLoopAgent
}

/** 工具输出归一为 ToolOutput 约定（渲染层按 output.ok 解析状态）。 */
function normalizeToolOutput(output: unknown): ToolOutput {
  if (output === null || output === undefined) return { ok: 'success' }
  if (typeof output === 'object' && typeof (output as { ok?: unknown }).ok === 'string') {
    return output as ToolOutput
  }
  return { ok: 'success', value: output }
}

function toFinishReason(reason: string): FinishReason {
  if (reason === 'length') return 'max-steps'
  if (reason === 'content-filter') return 'blocked'
  if (reason === 'error') return 'error'
  return 'stop'
}

/** AI SDK totalUsage → 回合累计用量；三项皆缺省时整体缺省（provider 可能不报 usage）。 */
export function toUsage(usage: unknown): TurnUsage | undefined {
  const u = (typeof usage === 'object' && usage !== null ? usage : {}) as Record<string, unknown>
  const inputTokens = typeof u.inputTokens === 'number' ? u.inputTokens : undefined
  const outputTokens = typeof u.outputTokens === 'number' ? u.outputTokens : undefined
  const totalTokens = typeof u.totalTokens === 'number' ? u.totalTokens : undefined
  // 缓存命中：ai v7 在 inputTokenDetails.cacheReadTokens，旧版形状是顶层
  // cachedInputTokens——两种形状都兼容，取不到即缺省（导出仅为可测，
  // engine/index.ts 不转发，不进公共 API）
  const details = u.inputTokenDetails as Record<string, unknown> | undefined
  const cachedInputTokens =
    (typeof details?.cacheReadTokens === 'number' ? details.cacheReadTokens : undefined) ??
    (typeof u.cachedInputTokens === 'number' ? u.cachedInputTokens : undefined)
  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) return undefined
  return { inputTokens, outputTokens, totalTokens, cachedInputTokens }
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/**
 * fullStream parts → AgentEvent 的翻译（引擎的协议出口）。
 *
 * 内部函数；part 判别按 AI SDK v7 TextStreamPart 的运行时形状 switch，
 * 未识别的 part（text-start/end、source、raw 等）静默跳过。每次调用对应
 * 一个回合，函数内维护一份回合内状态：在途工具调用集合（tool-call-start
 * 与 tool-result 的差集）。回合以 abort / error 收尾时，先按 start 顺序为
 * 在途调用补发合成 `tool-result { ok: 'aborted' }`（协议约定由 loop-react
 * 渲染为 interrupted 终态，渲染层的扫光按「收到 tool-result 即停」设计），
 * 再发收尾事件。宿主攒多轮历史时把合成结果与真实结果同等并入：保留
 * assistant(tool-call) + tool({ ok:'aborted' }) 完整一对，模型下一轮即知
 * 该调用被中止、不会失忆。这是 practi 验证过的做法（中止时写入真实
 * role:'tool' 消息）；AI SDK 只拒绝真正悬空的调用（AI_MissingToolResultsError），
 * 配对完整的 aborted 结果不在其列（见 README「多轮对话历史约定」）。
 */
async function* translateFullStream(fullStream: AsyncIterable<{ type: string }>): AsyncGenerator<AgentEvent> {
  const inflight = new Map<string, string>() // toolCallId → toolName（Map 保持 start 顺序）
  function* flushInflight(): Generator<AgentEvent> {
    for (const [toolCallId, toolName] of inflight) {
      yield { type: 'tool-result', toolCallId, toolName, output: { ok: 'aborted' } }
    }
    inflight.clear()
  }
  for await (const part of fullStream) {
    const p = part as Record<string, any>
    switch (p.type) {
      case 'text-delta':
        if (typeof p.text === 'string' && p.text !== '') yield { type: 'text-delta', text: p.text }
        break
      case 'reasoning-delta':
        if (typeof p.text === 'string' && p.text !== '') yield { type: 'reasoning-delta', text: p.text }
        break
      case 'tool-input-start':
        inflight.set(String(p.id), String(p.toolName))
        yield { type: 'tool-call-start', toolCallId: String(p.id), toolName: String(p.toolName) }
        break
      case 'tool-input-delta':
        yield { type: 'tool-call-args-delta', toolCallId: String(p.id), argsText: String(p.delta) }
        break
      case 'tool-call':
        yield { type: 'tool-call-input', toolCallId: p.toolCallId, input: p.input }
        break
      case 'tool-result':
        inflight.delete(String(p.toolCallId))
        yield {
          type: 'tool-result',
          toolCallId: p.toolCallId,
          toolName: p.toolName,
          output: normalizeToolOutput(p.output),
        }
        break
      case 'tool-error':
        inflight.delete(String(p.toolCallId))
        yield {
          type: 'tool-result',
          toolCallId: p.toolCallId,
          toolName: p.toolName,
          output: { ok: 'error', error: errorText(p.error) },
        }
        break
      case 'tool-approval-request':
        yield {
          type: 'approval-requested',
          toolCallId: p.toolCall?.toolCallId,
          args: p.toolCall?.input,
        }
        break
      case 'finish-step':
        yield { type: 'step-complete', usage: toUsage(p.usage) }
        break
      case 'finish':
        yield { type: 'turn-complete', finishReason: toFinishReason(p.finishReason), usage: toUsage(p.totalUsage) }
        break
      case 'abort':
        yield* flushInflight()
        yield { type: 'turn-complete', finishReason: 'aborted' }
        break
      case 'error':
        // 引擎 error 路径同样有在途调用悬挂；补发用 ok:'aborted' 而非
        // ok:'error'——后者按约定承载「工具自身执行出错」，而这里是回合
        // 层面被打断，工具没跑完不是工具的错（渲染层也据此显示 interrupted）
        yield* flushInflight()
        yield { type: 'error', message: errorText(p.error) }
        break
      default:
        break
    }
  }
}

/** 图片回注的 prepareStep 包装：先跑用户链（如有），再追加待注入图片。 */
function withImageLoopback(base: Record<string, unknown>): Record<string, unknown> {
  const userPrepare = base.prepareStep as ((input: any) => any) | undefined
  return {
    ...base,
    prepareStep: async (input: any) => {
      const result = (await userPrepare?.(input)) ?? {}
      const images = drainImages()
      if (images.length === 0) return result
      const messages: ModelMessage[] = [
        ...((result.messages as ModelMessage[] | undefined) ?? input.messages ?? []),
        {
          role: 'user',
          content: images.map(img => ({
            type: 'file' as const,
            data: img.data,
            url: img.url,
            mediaType: img.mediaType,
          })),
        },
      ]
      return { ...result, messages }
    },
  }
}

export function createLoopAgent(options: LoopAgentOptions): LoopAgent {
  const { model, instructions, tools, maxSteps = 20, imageLoopback = true } = options

  const settings: Record<string, unknown> = {
    model,
    instructions,
    tools,
    stopWhen: isStepCount(maxSteps),
    // 上下文重建依赖 messages 里的 system 消息（宿主的 scope note、随问旁路
    // 说明等，放 messages 而非 instructions 才能命中 KV 前缀缓存）——须向
    // AI SDK 声明放行（v7 standardizePrompt 默认拒绝）
    allowSystemInMessages: true,
  }
  const finalSettings = imageLoopback ? withImageLoopback(settings) : settings
  const raw = new ToolLoopAgent(finalSettings as ConstructorParameters<typeof ToolLoopAgent>[0])

  const bridge: UserBridge<unknown> = createUserBridge<unknown>()

  return {
    async *stream({ prompt, messages, abortSignal }: LoopAgentStreamInput) {
      const result = await raw.stream({
        ...(prompt !== undefined ? { prompt } : {}),
        ...(messages !== undefined ? { messages } : {}),
        abortSignal,
      } as Parameters<typeof raw.stream>[0])
      yield* translateFullStream(result.fullStream as AsyncIterable<{ type: string }>)
    },
    waitForUser<T = unknown>() {
      return bridge.waitForUser() as Promise<T>
    },
    resolveUser(value) {
      return bridge.resolveUser(value)
    },
    abandonUser() {
      bridge.abandonUser()
    },
    get userPending() {
      return bridge.pending
    },
    enqueueImage(image: LoopImagePart) {
      enqueueImage(image)
    },
    raw,
  }
}
