# loop

从 [practi](D:\dev\practi) / [anidea](D:\dev\anidea) / [okoknit](D:\order\okoknit) 三个项目抽提的 **AI agent 编排 + 工具渲染** 共享 npm 包。

- **`@arshdelight/loop-core`**：编排内核 —— AgentEvent 事件协议（引擎无关的公共语言）、StreamEntry 流归并 reducer（纯函数）、挂起工具选择器（宿主 UI 联动）。零 React 依赖。
- **`@arshdelight/loop-react`**：渲染层 —— ToolRow 工具行（dsh 式折叠行 + IN/OUT gutter）、工具渲染器注册表（下游注册专属渲染器，未注册工具落 Generic Fallback）、ReasoningBlock、theme.css（CSS 变量 token + Tailwind v4 映射 + 运行态扫光动画）、内置中英双字典的 t 协议 i18n。
- **`@arshdelight/loop-react/workbench`**（可选子模块）：渲染器预览工作台——下游应用装包后，在自己项目的 dev 页面挂 `<RendererWorkbench fixtures={...} />`，注册好的渲染器 + fixture 事件脚本即可离线预览（不调真实模型），自带主题/语言/回放速度切换。
- **`apps/playground`**：workbench 的 dogfooding 示例（示例渲染器 read / bash / ask_questions + 两个 fixture）。示例渲染器只属于 playground，**不随包分发**。

状态：阶段 0 已落地。路线：默认引擎（AI SDK v7 ToolLoopAgent 封装）→ 多模态归一化（DeepSeek / GLM / 豆包）→ markdown 渲染器（practi MarkdownBody 系）→ HITL 挂起桥。设计定调：**loop 保持最小形态，复杂引擎（如 practi 自研 loop）基于它构建**；**零内置工具**（2026-09-18 决策：包只提供机制——壳/注册表/Fallback/i18n/主题/workbench，渲染形态以 playground 示例存在，避免输出契约绑架下游）；**宿主 UI 联动走协议 B**（`findPendingTool` 选择器 + 宿主自己 watch 流状态实现输入框变形等，包不操纵宿主 UI）。

## 开发

```bash
pnpm install
pnpm typecheck   # 三个 workspace 全部通过
pnpm test        # vitest：core reducer + react 行模型
pnpm --filter @loop/playground dev   # playground 回放演示
```

## 术语

渲染层级自上而下：**条目列表 → 渲染器 → 行壳 → 组成部分**。

| 术语 | 含义 |
|---|---|
| **条目（Entry / StreamEntry）** | AgentEvent 流归并后的渲染单元，四种：text / reasoning / tool / error（core 包） |
| **渲染器（Renderer）** | 单个条目的完整渲染实现。工具渲染器按工具名从注册表分发（`registerToolRenderer` settled 版 / `registerStreamToolRenderer` 流式版），未注册的工具自动落 **Generic Fallback**；思考渲染器无注册表，所有思考块共用 |
| **行壳（ToolRow）** | dsh 式 disclosure row——任何工具渲染器的折叠行骨架，与展开体容器 |
| **图标槽** | 行壳左侧的变体图标位，hover 时图标淡出换 chevron（`ToolIcon`，按 `classifyToolVariant` 分类选 lucide 图标） |
| **标题（label）** | 折叠行的工具友好名（如 "Reading file"），`registerToolLabel` 可注册新工具的标题 |
| **摘要（summary）** | 标题后的参数单行摘要，`deriveToolSummary` 从 args 按常见键（command/path/query…）推导 |
| **尾随标记（trailing）** | 折叠行右缘状态位：仅错误/中断显示琥珀警示图标，成功无标记 |
| **actions 插槽** | 行内动作区（真实按钮，不触发展开） |
| **展开体（expanded body）** | 点击行后展开的内容区：左导轨（rail，2px 竖线）+ 限高滚动容器 |
| **GutterBlock（IN/OUT 栅格）** | 展开体里的等宽双列块：左窄列标签（IN/OUT）、右列内容，Z 行为 `whitespace-pre-wrap` |
| **GenericToolCard（通用兜底卡）** | 未注册工具的默认渲染 = 行壳 + IN/OUT 栅格 |
| **行模型（toolCallModel）** | 纯函数集：变体分类 / 摘要推导 / 错误首行 / 流式截断 JSON 抢救 |
| **ReasoningBlock（思考块）** | 思考条目渲染器：灯泡图标 + 「思考」标题 + 摘要（settled 显首行、流式显正在写的尾行并横向跟随）+ 展开体 |
| **扫光（sweep）** | 运行中行壳上的背景色光带（dsh glare-band）：一片 `--loop-bg` 背景色 60% 的宽带（300px）从行左外滑到右外，经过时把文字/图标「洗向背景色」再还原；行宽被布局归一化（摘要撑满剩余宽），固定 2.6s 时长对所有行等速；颜色天然随主题（亮色浅洪水 / 暗色深洪水）；运行结束类摘除即退场，零 JS 参与 |

## 下游用法（渲染层）

```tsx
import {
  LoopI18nProvider, useLoopT, StreamEntriesView,
  registerStreamToolRenderer, registerToolLabel,
  ToolRow, GutterBlock, type StreamToolRenderProps,
} from '@arshdelight/loop-react'
import '@arshdelight/loop-react/theme.css'

// 1. 注册你的工具专属渲染器（未注册的自动落 Generic Fallback）；
//    渲染器内文案统一走 t(key, params)，不要硬编码
registerStreamToolRenderer('my_tool', (props: StreamToolRenderProps) => {
  const t = useLoopT()
  return (
    <ToolRow toolName={props.toolCall.toolName} input={props.toolCall.input}
             status={props.toolResult ? 'ok' : 'running'}
             title={t('mytool.running')}>
      <GutterBlock label="OUT">{JSON.stringify(props.toolResult?.output)}</GutterBlock>
    </ToolRow>
  )
})
registerToolLabel('my_tool', 'My tool') // 无渲染器工具的静态标题覆盖

// 2. 事件流归并 + 一行渲染（事件来自 loop-core 的协议，引擎任意）
const entries = applyAgentEvents([], eventScript)
render(
  <LoopI18nProvider dict={{ 'reasoning.thought': '思考' }}>
    <StreamEntriesView entries={entries} />
  </LoopI18nProvider>,
)
```

## 渲染器预览（workbench）

下游应用（比如你的 APP0）注册了一堆自定义渲染器后，在自己项目里挂一个 dev 页面即可离线预览——不调真实模型，fixture 事件脚本驱动：

```tsx
// app0/dev/renderer-preview.tsx
import { RendererWorkbench } from '@arshdelight/loop-react/workbench'
import { registerMyTools } from '../tools'        // APP0 自己的渲染器注册
import { fixtures } from './fixtures'             // APP0 自己的 fixture 脚本

registerMyTools()

export function Page() {
  return <RendererWorkbench fixtures={fixtures} title="APP0 渲染器预览" />
}
```

自带：fixture 切换 chips、回放/重置/速度（1x/2x/4x）、主题切换（跟随系统/亮/暗）、语言切换（中/英）。fixture 是 `ReplayItem[]` 事件脚本（文本/参数按字符流式、工具间停顿），见 `apps/playground/src/fixtures` 的示例。

**输入框变形类工具**（ask_questions 等 HITL）的联动方式：工具渲染器只管聊天流内的卡片；输入框变形由宿主 UI 自己实现——用 core 的 `findPendingTool(entries, toolName)` 找挂起中的工具（入参完整且结果未到），找到了就切换 footer 形态，作答经回流通道 resolve（引擎侧挂起桥属路线图）。practi 的 QuestionInputBox 即此模式。

## i18n（文案协议）

渲染层零 i18n 库依赖，自带一个极小的 t 协议：

- **内置中英双字典**（`enDict` / `zhDict`，key 强制对齐）：`<LoopI18nProvider lang="zh">` 一键切语言；`lang` + `dict` 可组合（dict 优先微调）；新语言 = 往 `loopDicts` 加一份字典；
- **内置英文 fallback 字典 `enDict` 是 key 的唯一事实源**，key 分层命名（`reasoning.thought`、`tool.group`、`tool.awaitingApproval`…），类型从字典派生，拼错编译期报错；
- **字典值允许 `string | (params) => string`**——插值与英文复数住在字典值里（如 `tool.group` 的 `1 tool call / N tool calls`），中文包给无复数版本即可，loop 不引入插值库；
- **下游传 Partial 字典覆盖**（只需包含想改的 key），语言切换 = 换 dict 传值全树重渲；已有 react-i18next / next-intl 的宿主可现场从自己的 t 生成转发字典，Provider 即适配器；
- **未知 key 返回 key 本身**——漏翻译在界面上直接可见，不静默空白。

自定义渲染器的文案 key 通过 declaration merging 增补（编译期同样可查）：

```ts
declare module '@arshdelight/loop-react' {
  interface LoopCustomKeys {
    'mytool.running': string
    'mytool.done': string
  }
}
// 此后 t('mytool.running') 类型合法，dict 里可覆盖
```

工具行标题的分工：**有专属渲染器的工具**标题可传 `title` prop（或渲染器内 `t(key)`）；**未传 title 的工具**走内置默认标题表（`tool.label.*`，已纳入中英双字典，随 `lang` 切换——read → 读取文件、bash → 终端）；`registerToolLabel` 做静态覆盖（优先级最高，不响应语言切换，`unregisterToolLabel` 移除）；MCP 工具名按 `server · tool` 拆分展示（名称拼接，不翻译）。

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
