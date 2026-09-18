/**
 * Pure helpers shared by the tool-rendering SDK — labels, result-status
 * conventions (output.ok), and formatting. Living outside toolRegistry.tsx
 * lets the toolRow shell import them without a module cycle
 * (toolRegistry → genericToolCard → helpers, one direction).
 *
 * 与 practi 版的差异：toolNameLabel 支持下游 registerToolLabel 注册
 * 新工具的友好名；传入 t 时默认标题表走 i18n 字典（tool.label.*，
 * 中英双语见 i18nCore 的 enDict / zhDict）。
 */

import { enDict, type LoopLabelValue, type LoopTFunction, type LoopTKey } from './i18nCore'

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

const customLabels: Record<string, string> = {}

/** 注册（或覆盖）工具的行标题友好名——下游新增工具时配套调用。
 *  静态覆盖，不响应语言切换；动态多语言请传 t 或用渲染器 title。 */
export function registerToolLabel(toolName: string, label: string): void {
  customLabels[toolName] = label
}

/** 移除 registerToolLabel 的静态覆盖（如运行时切换语言前清理）。 */
export function unregisterToolLabel(toolName: string): void {
  delete customLabels[toolName]
}

/** 工具行默认标题。解析顺序：registerToolLabel 静态覆盖 > MCP
 *  server · tool 拆分 > t 字典（tool.label.<name>，未收录时跳过）>
 *  enDict 英文兜底 > 工具名本身。 */
export function toolNameLabel(name: string, t?: LoopTFunction): string {
  const custom = customLabels[name]
  if (custom !== undefined) return custom
  // MCP tools (mcp__<server>__<tool>) — show server · tool.
  if (name.startsWith('mcp__')) {
    const parts = name.split('__')
    if (parts.length >= 3) return `${parts[1]} · ${parts.slice(2).join('__')}`
  }
  if (t !== undefined) {
    // 动态 key 不在 LoopTKey 类型内；未知 key 时 t 返回 key 本身，据此回退
    const key = `tool.label.${name}` as LoopTKey
    const label = t(key)
    if (label !== key) return label
  }
  const builtin = (enDict as Record<string, LoopLabelValue>)[`tool.label.${name}`]
  return typeof builtin === 'string' ? builtin : name
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
