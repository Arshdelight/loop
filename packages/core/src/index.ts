export type {
  AgentEvent,
  AgentEventStream,
  FinishReason,
  ToolOutput,
  ToolResultOk,
  TurnUsage,
} from './events'
export type {
  StreamEntry,
  TextEntry,
  ReasoningEntry,
  ToolEntry,
  ErrorEntry,
} from './entries'
export {
  applyAgentEvent,
  applyAgentEvents,
  MAX_TEXT_ENTRY_LENGTH,
} from './reducer'
export { findPendingTool, hasPendingTool } from './selectors'

// 默认引擎（AI SDK v7 ToolLoopAgent 封装 → AgentEvent 流）
export * from './engine'

export const LOOP_CORE_VERSION = '0.1.3'
