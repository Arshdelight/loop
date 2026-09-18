# loop

从 [practi](D:\dev\practi) / [anidea](D:\dev\anidea) / [okoknit](D:\order\okoknit) 三个项目抽提的 **AI agent 编排 + 工具渲染** 共享 npm 包。

- **`@arshdelight/loop-core`**：编排内核 —— AgentEvent 事件协议（引擎无关的公共语言）、StreamEntry 流归并 reducer（纯函数）。零 React 依赖。
- **`@arshdelight/loop-react`**：渲染层 —— ToolRow 工具行（dsh 式折叠行 + IN/OUT gutter）、工具渲染器注册表（下游注册专属渲染器，未注册工具落 Generic Fallback）、ReasoningBlock、theme.css（CSS 变量 token + Tailwind v4 映射 + 运行态扫光动画）。
- **`apps/playground`**：fixture 事件流回放的演示场（read / bash 审批+流式输出 / ask_questions 表单卡 / MCP 兜底 / 错误行）。

状态：阶段 0 已落地（事件协议 + 渲染层 + playground）。路线：默认引擎（AI SDK v7 ToolLoopAgent 封装）→ 多模态归一化（DeepSeek / GLM / 豆包）→ markdown 渲染器（practi MarkdownBody 系）→ HITL 挂起桥。设计定调：**loop 包保持最小形态，复杂引擎（如 practi 自研 loop）基于它构建**。

## 开发

```bash
pnpm install
pnpm typecheck   # 三个 workspace 全部通过
pnpm test        # vitest：core reducer + react 行模型
pnpm --filter @loop/playground dev   # playground 回放演示
```

## 下游用法（渲染层）

```tsx
import {
  LoopLabelsProvider, StreamEntriesView,
  registerStreamToolRenderer, registerToolLabel,
  ToolRow, GutterBlock, type StreamToolRenderProps,
} from '@arshdelight/loop-react'
import '@arshdelight/loop-react/theme.css'

// 1. 注册你的工具专属渲染器（未注册的自动落 Generic Fallback）
registerStreamToolRenderer('my_tool', ({ toolCall, toolResult }: StreamToolRenderProps) => (
  <ToolRow toolName={toolCall.toolName} input={toolCall.input}
           status={toolResult ? 'ok' : 'running'}>
    <GutterBlock label="OUT">{JSON.stringify(toolResult?.output)}</GutterBlock>
  </ToolRow>
))
registerToolLabel('my_tool', 'My tool')

// 2. 事件流归并 + 一行渲染（事件来自 loop-core 的协议，引擎任意）
const entries = applyAgentEvents([], eventScript)
render(
  <LoopLabelsProvider labels={{ thought: '思考' }}>
    <StreamEntriesView entries={entries} />
  </LoopLabelsProvider>,
)
```

样式：Tailwind v4 作为 peerDependency；下游 css 依次 `@import "tailwindcss"` 与
`@arshdelight/loop-react/theme.css`，并把本包源码目录加入 Tailwind 的 source
扫描（见 apps/playground/src/index.css）。换肤 = 覆盖 `--loop-*` CSS 变量。

## 架构调研摘要

三个上游项目的公共模式（已验证三轮重复）：

| 模式 | practi | anidea | okoknit |
|---|---|---|---|
| AI SDK | v7（仅传输层，自研 loop） | v7（ToolLoopAgent） | v7（ToolLoopAgent） |
| 工具 schema | 手写 JSON Schema | zod v4 | 手写 JSON Schema |
| 多模态图片注入 | content parts 展开 | prepareStep + Files API | prepareStep + pendingImages |
| ToolRow | React 原版 | vanilla 移植 | React 简化版 |
| markdown | react-markdown 全家桶 | marked（无高亮） | 无 |
| 流式传输 | Electron IPC 广播 | NDJSON over HTTP | Electron IPC |

生态结论：底座选 Vercel AI SDK v7；LangGraph 概念吸收（可恢复中断、thread 持久化）不整包引入；工具渲染注册 API 参考 assistant-ui 的 `defineToolkit`（注册表 + 状态机 props + Fallback 兜底）。
