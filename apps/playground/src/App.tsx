import { RendererWorkbench } from '@arshdelight/loop-react/workbench'
import { fixtures } from './fixtures/conversation'
import { registerDemoRenderers } from './renderers'

// playground = RendererWorkbench 的 dogfooding 示例：示例渲染器
// （read / bash / ask_questions，见 renderers.tsx）+ fixture 脚本，
// 演示下游「注册自己的渲染器 → 在 workbench 里预览」的完整用法。
registerDemoRenderers()

export function App() {
  return (
    <RendererWorkbench
      fixtures={fixtures}
      title="loop playground · 示例渲染器预览"
    />
  )
}
