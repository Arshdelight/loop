// @arshdelight/loop-react — agent 渲染层
//
// 模块地图（源自 practi 渲染层，2026-09-18 抽提）：
// - toolRow/ToolRow.tsx      dsh 式工具行壳（折叠行 + 展开导轨）+ GutterBlock
// - toolRow/toolCallModel.ts 纯函数行模型（变体分类 / 摘要 / 错误首行 / 流式抢救）
// - toolRow/toolIcon.tsx     变体 → lucide 图标
// - toolRow/genericToolCard  通用 Fallback 卡（未注册工具 / MCP 的 IN/OUT 视图）
// - toolRegistry.tsx         渲染器注册表 + 分发器 + ReasoningBlock
// - toolHelpers.ts           labels / output.ok 状态约定 / 格式化
// - streamEntriesView.tsx    StreamEntry[] → 一行渲染（含 ToolEntry 桥接）
// - labels.tsx               文案注入（替代上游 i18n 依赖）
// - theme.css                token + Tailwind v4 映射 + 扫光动画

// 壳与纯函数
export { ToolRow, GutterBlock, type ToolRowProps, type ToolRowStatus } from './toolRow/ToolRow'
export { ToolIcon } from './toolRow/toolIcon'
export {
  classifyToolVariant, deriveToolSummary, firstErrorLine, tryParseJson, salvageStringArg,
  type ToolVariant,
} from './toolRow/toolCallModel'
export { GenericToolCard, GenericStreamToolCard } from './toolRow/genericToolCard'

// 注册表与分发
export {
  registerToolRenderer, registerStreamToolRenderer,
  ToolRenderer, StreamToolRenderer, ReasoningBlock,
} from './toolRegistry'

// 渲染器 props 契约（下游自定义渲染器的类型）
export type {
  ToolRenderProps, StreamToolRenderProps, ToolResultStatus,
} from './toolHelpers'

// 条目视图
export { StreamEntriesView, ToolEntryView, TextBlock, ErrorBlock } from './streamEntriesView'

// 文案注入
export { LoopLabelsProvider, useLoopLabels, DEFAULT_LOOP_LABELS, type LoopLabels } from './labels'

// 纯 helpers（注册表模块的再导出，保持单一入口）
export { registerToolLabel, toolNameLabel, formatResult } from './toolHelpers'

export const LOOP_REACT_VERSION = '0.0.1'
