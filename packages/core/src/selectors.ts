/**
 * findPendingTool — 挂起中工具选择器（宿主 UI 联动协议的机制层，决策 B）。
 *
 * practi 的 QuestionInputBox 模式泛化：宿主的流外 UI（输入框变形、侧栏、
 * 审批条）不依赖工具渲染器，而是自己 watch 流状态里的「挂起中工具」。
 * 本选择器提供统一判据：入参完整（input 已 settled）且结果未到，即视为
 * 挂起中、可被宿主 UI 接管作答；答案经引擎侧回流通道 resolve（阶段 1）。
 */

import type { StreamEntry, ToolEntry } from './entries'

export function findPendingTool(entries: StreamEntry[], toolName: string): ToolEntry | undefined {
  return entries.find(
    (e): e is ToolEntry =>
      e.kind === 'tool'
      && e.toolName === toolName
      && e.input !== undefined
      && e.output === undefined,
  )
}

/** 是否存在任意挂起中的工具（输入框变形等互斥 UI 的守卫）。 */
export function hasPendingTool(entries: StreamEntry[]): boolean {
  return entries.some(
    e => e.kind === 'tool' && e.input !== undefined && e.output === undefined,
  )
}
