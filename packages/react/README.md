# @arshdelight/loop-react

loop 的渲染层：**ToolRow** 工具行（dsh 式折叠行 + IN/OUT gutter）、**工具渲染器注册表**（下游注册专属渲染器，未注册工具落 Generic Fallback）、**markdown 渲染器**（highlight.js 代码高亮 / katex 公式 / mermaid 图表 / 流式光标）、中英双字典 t 协议 i18n、深浅自适应主题、**渲染器预览工作台**（可选子模块）。

```tsx
import {
  LoopI18nProvider, StreamEntriesView,
  registerStreamToolRenderer, useLoopT,
  ToolRow, GutterBlock, type StreamToolRenderProps,
} from '@arshdelight/loop-react'
// css 入口依次引入（写法见下方样式节）：
//   @import "tailwindcss";
//   @import "@arshdelight/loop-react/theme.css";
//   @import "@arshdelight/loop-react/markdown.css";

registerStreamToolRenderer('my_tool', (props: StreamToolRenderProps) => {
  const t = useLoopT()
  return (
    <ToolRow toolName={props.toolCall.toolName} input={props.toolCall.input}
             status={props.toolResult ? 'ok' : 'running'} title={t('mytool.running')}>
      <GutterBlock label="OUT">{JSON.stringify(props.toolResult?.output)}</GutterBlock>
    </ToolRow>
  )
})

function Chat({ entries, running }) {
  return (
    <LoopI18nProvider lang="zh">
      <StreamEntriesView entries={entries} streaming={running} />
    </LoopI18nProvider>
  )
}
```

样式：Tailwind v4 作为 peerDependency；下游 css 依次引入 `tailwindcss`、本包的
`theme.css` 与 `markdown.css`，并把本包 dist 加入 Tailwind 的 source 扫描。
换肤 = 覆盖 `--loop-*` CSS 变量；工具行标题等文案全部走 t 协议（内置中英双字典，
`LoopI18nProvider lang` 一键切换）。

- 术语表与下游用法：[仓库 README](https://github.com/arshdelight/loop/blob/main/README.md)
- 事件协议（渲染的数据来源）：`@arshdelight/loop-core`
- 渲染器离线预览：`@arshdelight/loop-react/workbench` 的 `RendererWorkbench`

MIT License.
