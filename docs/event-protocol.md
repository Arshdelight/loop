# 事件协议参考（AgentEvent）

> loop 的核心公共语言：**引擎无关的事件流**。默认引擎（`createLoopAgent`）产出它，
> practi 式自研复杂引擎也应以它为输出——UI 层（loop-react）只认协议，不认引擎。

## 事件一览

| 事件 | 载荷 | 语义 |
|---|---|---|
| `reasoning-delta` | `text` | 思考流增量（DeepSeek/GLM thinking 等） |
| `text-delta` | `text` | 正文流增量 |
| `tool-call-start` | `toolCallId, toolName` | 工具调用开始（参数尚未流式） |
| `tool-call-args-delta` | `toolCallId, argsText` | 工具参数流式增量（未闭合 JSON，渲染层有抢救显示） |
| `tool-call-input` | `toolCallId, input` | 参数 settled（完整对象，替代 streamingArgs） |
| `tool-output-delta` | `toolCallId, outputText` | 工具执行输出流式增量（如 bash 实时 stdout） |
| `approval-requested` | `toolCallId, level?, args?` | 工具需要人工审批（HITL） |
| `tool-result` | `toolCallId, toolName?, output` | 工具终态；`output.ok ∈ success / error / aborted / interjected` |
| `step-complete` | — | 一个 step（LLM 调用 + 工具批次）结束 |
| `turn-complete` | `finishReason, usage?` | 回合结束：`stop / aborted / error / max-steps / blocked`；`usage` 为回合累计 token 用量（input/output/total，provider 未上报时缺省） |
| `error` | `message` | 非致命错误（渲染为错误条目） |

约定：**错误没有独立事件**——`tool-result` 的 `ok:'error'` + `error` 字段承载；所有工具
output 归一为 `{ ok, error?, ...产物 }`（引擎对非约定形状自动包 `{ok:'success', value}`）。

## 消费方式

```ts
const entries = applyAgentEvents([], agent.stream({ prompt: 'hi' }))  // 批量
for await (const event of agent.stream({ prompt: 'hi' })) dispatch(event)  // 流式 → useReducer
```

渲染一行接入：`<StreamEntriesView entries={entries} streaming={running} />`。

## 引擎映射（默认引擎 = AI SDK v7 ToolLoopAgent）

| fullStream part | AgentEvent |
|---|---|
| `text-delta` | `text-delta` |
| `reasoning-delta` | `reasoning-delta` |
| `tool-input-start` / `tool-input-delta` | `tool-call-start` / `tool-call-args-delta` |
| `tool-call` | `tool-call-input` |
| `tool-result` / `tool-error` | `tool-result`（error 归一为 ok:'error'） |
| `tool-approval-request` | `approval-requested` |
| `finish-step` | `step-complete` |
| `finish` / `abort` / `error` | `turn-complete`（finishReason 映射）/ `error` |

未识别的 part（text-start/end、source、raw 等）静默跳过。

回合以 `abort` / `error` 收尾时，引擎先按 `tool-call-start` 出现顺序为在途调用
（已 start 未收到 result）补发合成 `tool-result`（`output: {ok:'aborted'}`），再发
收尾事件——渲染层据此把工具行落到 interrupted 终态，而不是永远悬挂运行态。宿主
攒多轮历史时把合成结果与真实结果同等并入，保留 assistant(tool-call) +
tool({ok:'aborted'}) 完整一对——模型由此知道该调用被中止、不会失忆（见 README
「多轮对话历史约定」）。

## HITL（人在环路）

ask 类工具的 execute 内 `await agent.waitForUser()` 挂起；宿主用
`findPendingTool(entries, toolName)` 找到挂起行（input settled 且无 output），
收集回答后 `agent.resolveUser(output)` 回流。单槽（同时只支持一个挂起），与
practi 后端行为一致。

## 多模态回注

工具产出图片 `agent.enqueueImage({ data, mediaType })`，引擎在下一步前把队列
作为 user file part 消息追加（prepareStep 注入）——三家上游各自踩过的
「OpenAI 兼容端点 tool 消息只收字符串」坑的统一解法。

## 多轮对话（历史回灌）

`agent.stream({ messages })` 的多轮历史由宿主自己攒（ModelMessage[]）。约定：
assistant 消息里的 `tool-call` 与紧随其后的独立 `role:'tool'` 消息里的
`tool-result` 必须成对出现、不留悬空调用（中止回合的 `{ok:'aborted'}` 合成
结果即其结果，照常配对入历史）——嵌在 assistant 消息里的 tool-result
会被 AI SDK 提示词转换忽略，悬空调用导致下回合抛 `AI_MissingToolResultsError`。
最小形状示例与 `appendAssistantTurn` 辅助函数见
[README「多轮对话历史约定」](../README.md#多轮对话历史约定默认引擎)。
