/**
 * Pure helpers shared by the tool-rendering SDK — labels, result-status
 * conventions (output.ok), and formatting. Living outside toolRegistry.tsx
 * lets the toolRow shell import them without a module cycle
 * (toolRegistry → genericToolCard → helpers, one direction).
 *
 * 与 practi 版的差异：toolNameLabel 支持下游 registerToolLabel 注册
 * 新工具的友好名（新工具 + 新渲染器一起注册是包的核心用法）。
 */

export interface ToolRenderProps {
  calls: Array<{ toolCallId: string; toolName: string; input: unknown }>
  results: Record<string, string>
}

export interface StreamToolRenderProps {
  toolCall: { toolCallId: string; toolName: string; input: unknown }
  streamingArgs?: string
  streamingOutput?: string
  toolResult?: { toolCallId: string; toolName: string; output: unknown }
  pendingApproval?: { level?: string; args?: Record<string, unknown> }
}

const BUILTIN_LABELS: Record<string, string> = {
  ask_questions: 'Asking you',
  web_search: 'Searching web',
  webpage_view: 'Reading page',
  read: 'Reading file',
  glob: 'Finding files',
  grep: 'Searching contents',
  write: 'Writing file',
  edit: 'Editing file',
  add_to_workspace: 'Adding to workspace',
  bash: 'Terminal',
  skill: 'Loading skill',
  // Sub-agent tools (agents-as-tools). The name is the agent name.
  hippo: 'Digesting conversation',
  research: 'Researching',
  general: 'Running sub-task',
}

const customLabels: Record<string, string> = {}

/** 注册（或覆盖）工具的行标题友好名——下游新增工具时配套调用。 */
export function registerToolLabel(toolName: string, label: string): void {
  customLabels[toolName] = label
}

export function toolNameLabel(name: string): string {
  const custom = customLabels[name]
  if (custom !== undefined) return custom
  // MCP tools (mcp__<server>__<tool>) — show server · tool.
  if (name.startsWith('mcp__')) {
    const parts = name.split('__')
    if (parts.length >= 3) return `${parts[1]} · ${parts.slice(2).join('__')}`
  }
  return BUILTIN_LABELS[name] ?? name
}

export function formatResult(content: string): string {
  try {
    const parsed = JSON.parse(content)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return content
  }
}

export type ToolResultStatus = 'success' | 'error' | 'interrupted' | null

export function getResultStatus(resultStr: string | undefined): ToolResultStatus {
  if (!resultStr) return null
  try {
    const parsed = JSON.parse(resultStr)
    if (parsed && typeof parsed.ok === 'string') {
      if (parsed.ok === 'success') return 'success'
      if (parsed.ok === 'aborted' || parsed.ok === 'interjected') return 'interrupted'
      if (parsed.ok === 'error') return 'error'
    }
  } catch { /* ignore */ }
  return null
}

export function getOutputStatus(output: unknown): ToolResultStatus {
  if (!output) return null
  const obj = output as Record<string, unknown>
  if (typeof obj.ok === 'string') {
    if (obj.ok === 'success') return 'success'
    if (obj.ok === 'aborted' || obj.ok === 'interjected') return 'interrupted'
    if (obj.ok === 'error') return 'error'
  }
  return null
}

export function getResultError(resultStr: string | undefined): string | null {
  const status = getResultStatus(resultStr)
  if (status !== 'error') return null
  try {
    const parsed = JSON.parse(resultStr!)
    return typeof parsed.error === 'string' ? parsed.error : null
  } catch { return null }
}

export function getResultInterrupted(resultStr: string | undefined): boolean {
  return getResultStatus(resultStr) === 'interrupted'
}

export function getOutputError(output: unknown): string | null {
  const status = getOutputStatus(output)
  if (status !== 'error') return null
  const obj = output as Record<string, unknown>
  return typeof obj.error === 'string' ? obj.error : null
}

export function getOutputInterrupted(output: unknown): boolean {
  return getOutputStatus(output) === 'interrupted'
}
