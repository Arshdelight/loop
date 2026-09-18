export type {
  AgentEvent,
  AgentEventStream,
  FinishReason,
  ToolOutput,
  ToolResultOk,
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

export const LOOP_CORE_VERSION = '0.0.1'
