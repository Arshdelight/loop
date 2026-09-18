import { createContext, useContext, type ReactNode } from 'react'

/**
 * loop 渲染层的文案注入（替代上游项目里的 useI18n 依赖）：
 * 渲染层零业务耦合——所有 UI 文案默认内置英文（与 practi 一致），
 * 下游用 LoopLabelsProvider 覆盖（如中文）。
 */
export interface LoopLabels {
  /** ReasoningBlock 折叠行标题。 */
  thought: string
  /** 混名工具组标题，如 "3 tool calls"。 */
  toolCalls: (count: number) => string
  /** 审批等待中追加到行摘要后的提示。 */
  awaitingApproval: string
}

export const DEFAULT_LOOP_LABELS: LoopLabels = {
  thought: 'Thinking',
  toolCalls: (count) => `${count} tool calls`,
  awaitingApproval: 'awaiting approval',
}

const LoopLabelsContext = createContext<LoopLabels>(DEFAULT_LOOP_LABELS)

export function LoopLabelsProvider({ labels, children }: {
  labels?: Partial<LoopLabels>
  children: ReactNode
}) {
  return (
    <LoopLabelsContext.Provider value={{ ...DEFAULT_LOOP_LABELS, ...labels }}>
      {children}
    </LoopLabelsContext.Provider>
  )
}

export function useLoopLabels(): LoopLabels {
  return useContext(LoopLabelsContext)
}
