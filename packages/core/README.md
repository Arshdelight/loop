# @arshdelight/loop-core

AI agent 编排内核：引擎无关的 **AgentEvent 事件协议**、流归并 reducer、基于 Vercel AI SDK v7 ToolLoopAgent 的默认引擎（HITL 挂起桥、图片回注）、DeepSeek / GLM / 豆包 provider 预设。

```ts
import { createLoopAgent, createZaiModel, applyAgentEvent } from '@arshdelight/loop-core'

const agent = createLoopAgent({
  model: createZaiModel({ apiKey: process.env.ZAI_API_KEY! }),
  tools: {
    ask_user: tool({
      inputSchema: jsonSchema({ type: 'object' }),
      execute: async () => agent.waitForUser(),   // HITL：挂起等用户作答
    }),
  },
})

for await (const event of agent.stream({ prompt: 'hi' })) {
  dispatch(event) // AgentEvent —— 渲染层（@arshdelight/loop-react）只认这套协议
}
```

- 事件协议全表与引擎映射：[docs/event-protocol.md](https://github.com/arshdelight/loop/blob/main/docs/event-protocol.md)
- 多轮对话：历史里的工具调用必须 assistant(`tool-call`) + 独立 `role:'tool'` 消息(`tool-result`) 成对出现、不留悬空调用（否则 AI SDK 抛 `AI_MissingToolResultsError`）；用 `appendAssistantTurn` 把每回合产出按约定追加进历史
- 渲染层（ToolRow / 注册表 / markdown / workbench）：`@arshdelight/loop-react`
- peer 依赖：`ai@^7`；用哪家 provider 就装对应的 `@ai-sdk/deepseek` / `@ai-sdk/zai` / `@ai-sdk/openai-compatible`（均 optional）

MIT License.
