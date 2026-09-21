/**
 * appendAssistantTurn —— 宿主多轮历史的回合追加辅助。
 *
 * AI SDK v7 的提示词转换（convertToLanguageModelPrompt）只认独立
 * role:'tool' 消息里的 tool-result：嵌在 assistant 消息 content 里的
 * tool-result 被完全忽略；只要历史里有悬空的 tool-call（没有对应结果），
 * 转换遇到下一条 user 消息时即抛 AI_MissingToolResultsError。本函数把
 * 宿主从 AgentEvent 流攒出的一回合产出按约定形状成对追加（形状约定详见
 * README「多轮对话历史约定」）：
 * - 有工具调用：assistant(text? + tool-call…) 后紧跟 tool(tool-result…)；
 *   完全没结果的调用整对丢弃，不留悬空调用（中止回合的合成结果
 *   {ok:'aborted'} 照常配对入历史，见 README「多轮对话历史约定」）；
 * - 只有文本：单条 assistant 消息；
 * - 什么都没有：原数组原样返回。
 */

import type { JSONValue, ModelMessage, ToolCallPart, ToolResultPart } from 'ai'
import type { ToolOutput } from '../events'

/** 一个回合的产出（宿主消费 AgentEvent 流时攒下的三样东西）。 */
export interface AssistantTurn {
  /** assistant 的正文文本（无则省略）。 */
  text?: string
  /** 本回合发起的工具调用（input 已 settled）。 */
  toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }>
  /** 工具结果（含中止回合的 {ok:'aborted'} 合成结果），按 toolCallId 索引；缺项的调用整对丢弃。 */
  toolResults: ReadonlyMap<string, ToolOutput>
}

export function appendAssistantTurn(messages: ModelMessage[], turn: AssistantTurn): ModelMessage[] {
  const callParts: ToolCallPart[] = []
  const resultParts: ToolResultPart[] = []
  for (const call of turn.toolCalls) {
    const output = turn.toolResults.get(call.toolCallId)
    if (output === undefined) continue
    callParts.push({ type: 'tool-call', ...call })
    resultParts.push({
      type: 'tool-result',
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      // ToolOutput 是 JSON 对象约定（ok 字段），提示词转换收 JSONValue
      output: { type: 'json', value: output as JSONValue },
    })
  }
  if (callParts.length > 0) {
    return [
      ...messages,
      {
        role: 'assistant',
        content: [...(turn.text ? [{ type: 'text' as const, text: turn.text }] : []), ...callParts],
      },
      { role: 'tool', content: resultParts },
    ]
  }
  if (turn.text) {
    return [...messages, { role: 'assistant', content: [{ type: 'text', text: turn.text }] }]
  }
  return messages
}
