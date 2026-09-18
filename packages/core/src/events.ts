/**
 * AgentEvent — loop 的核心事件协议（阶段 0：类型层）。
 *
 * 设计原则（来自 2026-09-18 架构决策）：
 * - 最小形态：这是「一条 agent 回合从开始到结束的扁平事件流」的公共语言。
 *   默认引擎（AI SDK ToolLoopAgent 封装）产出它，practi 式自研复杂引擎也
 *   应产出它——UI 层只认这套协议，不认引擎。
 * - 融合三个上游项目的事件方言：practi 的 AgentEvent（IPC 广播）、
 *   anidea 的 NDJSON `{t:'text'|'tool-call'|...}`、okoknit 的 AgentEventMsg。
 * - 工具结果统一走 tool-result + output.ok 状态约定（practi 约定），
 *   没有独立的 tool-error 事件——错误是 `ok:'error'` + `error` 字段。
 */

/** 工具结果的终态约定：所有引擎产出的 tool output 都应带 ok 字段。 */
export type ToolResultOk = 'success' | 'error' | 'aborted' | 'interjected'

export interface ToolOutput {
  ok: ToolResultOk
  /** ok 为 error 时的错误正文（可多行，渲染层取首行）。 */
  error?: string
  /** 工具其余结构化产物（渲染器按工具名自行解析）。 */
  [key: string]: unknown
}

export type FinishReason =
  | 'stop'
  | 'aborted'
  | 'error'
  | 'max-steps'
  | 'blocked'

/** 回合累计 token 用量（默认引擎取 AI SDK finish part 的 totalUsage）。 */
export interface TurnUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export type AgentEvent =
  | { type: 'reasoning-delta'; text: string }
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call-start'; toolCallId: string; toolName: string }
  /** 工具参数的流式增量（未闭合 JSON 文本，渲染层有抢救显示逻辑）。 */
  | { type: 'tool-call-args-delta'; toolCallId: string; argsText: string }
  /** 本轮 LLM 已给出完整工具入参（settled，替代 streamingArgs）。 */
  | { type: 'tool-call-input'; toolCallId: string; input: unknown }
  /** 工具执行输出的流式增量（如 bash 的实时 stdout）。 */
  | { type: 'tool-output-delta'; toolCallId: string; outputText: string }
  /** 工具需要人工审批（HITL）；等待期渲染层显示审批提示。 */
  | { type: 'approval-requested'; toolCallId: string; level?: string; args?: Record<string, unknown> }
  | {
      type: 'tool-result'
      toolCallId: string
      /** 传输层丢失 start 时的容错回填依据（okoknit 模式）。 */
      toolName?: string
      output: ToolOutput
    }
  /** 一个 step（LLM 调用 + 工具批次）结束。 */
  | { type: 'step-complete' }
  | {
      type: 'turn-complete'
      finishReason: FinishReason
      /** 回合累计 token 用量（provider 未上报或字段缺失时缺省）。 */
      usage?: TurnUsage
    }
  | { type: 'error'; message: string }

/** 引擎实现方约定的最小接口：一个 async iterable 的 AgentEvent 流。 */
export type AgentEventStream = AsyncIterable<AgentEvent>
