/**
 * StreamEntry — AgentEvent 流归并后的「渲染条目」模型。
 *
 * 对应 practi 的 StreamEntry（streamEntries 列表）与 okoknit 的
 * ProcessEntry：文本/思考增量合并成块，工具调用按 id 聚合成条。
 * 条目不存派生状态（running/ok/error）——渲染层从 output 推导，
 * 保持条目是纯数据、可序列化、可从持久层重建。
 */

export interface TextEntry {
  kind: 'text'
  text: string
}

export interface ReasoningEntry {
  kind: 'reasoning'
  text: string
}

export interface ToolEntry {
  kind: 'tool'
  toolCallId: string
  toolName: string
  /** settled 后的完整入参（来自 tool-call-input）。 */
  input?: unknown
  /** 流式累积中的参数 JSON 文本（settled 后由 input 接替）。 */
  streamingArgs?: string
  /** 流式累积中的执行输出（settled 后由 output 接替）。 */
  streamingOutput?: string
  /** settled 的工具结果（ToolOutput 或引擎给出的原始值）。 */
  output?: unknown
  pendingApproval?: { level?: string; args?: Record<string, unknown> }
}

export interface ErrorEntry {
  kind: 'error'
  text: string
}

export type StreamEntry = TextEntry | ReasoningEntry | ToolEntry | ErrorEntry
