import type { AgentEvent } from '@arshdelight/loop-core'
import type { ReplayItem, WorkbenchFixture } from '@arshdelight/loop-react/workbench'

/**
 * 一段覆盖全部事件形态的演示回合脚本：
 * 思考流 → 文本 → read×2 → bash（审批 + 流式输出）→ ask_questions（表单卡）
 * → 未注册 MCP 工具（Generic Fallback 兜底）→ write 失败（错误行）→ 收尾。
 */
export const demoConversation: ReplayItem[] = [
  { stream: '用户想了解 loop 包的渲染方式。先读 ToolRow 的实现，再看注册表的分发逻辑，最后用一个 MCP 工具对照兜底渲染。', as: 'reasoning-delta', charDelay: 18 },
  { stream: '我来分析一下渲染层的结构。', as: 'text-delta' },

  { event: { type: 'tool-call-start', toolCallId: 't1', toolName: 'read' } },
  { stream: '{"path":"packages/react/src/toolRow/ToolRow.tsx"}', as: 'tool-call-args-delta', toolCallId: 't1', charDelay: 14 },
  { event: { type: 'tool-call-input', toolCallId: 't1', input: { path: 'packages/react/src/toolRow/ToolRow.tsx' } }, delay: 500 },
  { event: { type: 'tool-result', toolCallId: 't1', output: { ok: 'success', content: 'export function ToolRow(props: ToolRowProps) {\n  const [internalOpen, setInternalOpen] = useState(defaultOpen)\n  // …139 行\n}' } }, delay: 450 },

  { stream: '注册表是渲染分发的核心，也读一下。', as: 'text-delta' },
  { event: { type: 'tool-call-start', toolCallId: 't2', toolName: 'read' } },
  { stream: '{"path":"packages/react/src/toolRegistry.tsx"}', as: 'tool-call-args-delta', toolCallId: 't2', charDelay: 14 },
  { event: { type: 'tool-call-input', toolCallId: 't2', input: { path: 'packages/react/src/toolRegistry.tsx' } }, delay: 450 },
  { event: { type: 'tool-result', toolCallId: 't2', output: { ok: 'success', content: 'export function registerToolRenderer(toolName, renderer) { … }\nexport function StreamToolRenderer(props) { … }' } }, delay: 400 },

  { stream: '两份实现都确认了：壳 + 注册表 + Fallback 的三层结构。接下来跑个命令验证。', as: 'reasoning-delta', charDelay: 16 },
  { event: { type: 'tool-call-start', toolCallId: 't3', toolName: 'bash' } },
  { stream: '{"command":"pnpm typecheck"}', as: 'tool-call-args-delta', toolCallId: 't3', charDelay: 16 },
  { event: { type: 'tool-call-input', toolCallId: 't3', input: { command: 'pnpm typecheck' } }, delay: 300 },
  { event: { type: 'approval-requested', toolCallId: 't3', level: 'confirm', args: { command: 'pnpm typecheck' } }, delay: 1400 },
  { stream: '> loop-monorepo@ typecheck\n> pnpm -r typecheck\n\npackages/core typecheck$ tsc --noEmit\npackages/core typecheck: Done\npackages/react typecheck$ tsc --noEmit\npackages/react typecheck: Done', as: 'tool-output-delta', toolCallId: 't3', charDelay: 20 },
  { event: { type: 'tool-result', toolCallId: 't3', output: { ok: 'success', stdout: '> loop-monorepo@ typecheck\n> pnpm -r typecheck\n\npackages/core typecheck: Done\npackages/react typecheck: Done' } }, delay: 500 },

  { stream: '类型全绿。按惯例问一下用户要不要继续写示例。', as: 'reasoning-delta', charDelay: 16 },
  { event: { type: 'tool-call-start', toolCallId: 't4', toolName: 'ask_questions' } },
  { stream: '{"questions":[{"id":"q1","question":"要在 README 里加渲染器注册示例吗？","options":["加，越详细越好","简短一段就好","不用"]}]}', as: 'tool-call-args-delta', toolCallId: 't4', charDelay: 12 },
  { event: { type: 'tool-call-input', toolCallId: 't4', input: { questions: [{ id: 'q1', question: '要在 README 里加渲染器注册示例吗？', options: ['加，越详细越好', '简短一段就好', '不用'] }] } }, delay: 400 },
  { event: { type: 'tool-result', toolCallId: 't4', output: { ok: 'success', questions: [{ id: 'q1', question: '要在 README 里加渲染器注册示例吗？', options: ['加，越详细越好', '简短一段就好', '不用'], answer: '简短一段就好' }] } }, delay: 500 },

  { stream: '好的，简短一段。再对照一个未注册的 MCP 工具看看兜底渲染。', as: 'reasoning-delta', charDelay: 16 },
  { event: { type: 'tool-call-start', toolCallId: 't5', toolName: 'mcp__github__search_issues' } },
  { stream: '{"query":"tool renderer registry","limit":5}', as: 'tool-call-args-delta', toolCallId: 't5', charDelay: 14 },
  { event: { type: 'tool-call-input', toolCallId: 't5', input: { query: 'tool renderer registry', limit: 5 } }, delay: 500 },
  { event: { type: 'tool-result', toolCallId: 't5', output: { ok: 'success', items: [{ title: 'Add pluggable tool UI', url: 'https://github.com/example/1' }] } }, delay: 450 },

  { stream: '最后试一下写文件（会失败，用来演示错误行样式）。', as: 'reasoning-delta', charDelay: 16 },
  { event: { type: 'tool-call-start', toolCallId: 't6', toolName: 'write' } },
  { stream: '{"path":"readonly/README.md","content":"# hi"}', as: 'tool-call-args-delta', toolCallId: 't6', charDelay: 14 },
  { event: { type: 'tool-call-input', toolCallId: 't6', input: { path: 'readonly/README.md', content: '# hi' } }, delay: 450 },
  { event: { type: 'tool-result', toolCallId: 't6', output: { ok: 'error', error: 'EACCES: permission denied, open \'readonly/README.md\'\n    at writeFile (fs.js:123)' } }, delay: 450 },

  { stream: '渲染层三层结构验证完毕：ToolRow 壳、注册表分发、Generic 兜底。错误与审批样式也都过了一遍。', as: 'text-delta' },
  { event: { type: 'turn-complete', finishReason: 'stop' }, delay: 0 },
]

/** 状态速览：成功 / 错误 / 中断 三种终态 + 一个停在审批中的行（不收尾）。 */
const statesOverview: ReplayItem[] = [
  { stream: '三种终态一次看完。', as: 'text-delta' },
  { event: { type: 'tool-call-start', toolCallId: 's1', toolName: 'read' } },
  { event: { type: 'tool-call-input', toolCallId: 's1', input: { path: 'ok.ts' } }, delay: 250 },
  { event: { type: 'tool-result', toolCallId: 's1', output: { ok: 'success', content: 'export const a = 1' } }, delay: 250 },
  { event: { type: 'tool-call-start', toolCallId: 's2', toolName: 'write' } },
  { event: { type: 'tool-call-input', toolCallId: 's2', input: { path: 'readonly/x.md' } }, delay: 250 },
  { event: { type: 'tool-result', toolCallId: 's2', output: { ok: 'error', error: "EACCES: permission denied, open 'readonly/x.md'\n    at writeFile (fs.js:123)" } }, delay: 250 },
  { event: { type: 'tool-call-start', toolCallId: 's3', toolName: 'bash' } },
  { event: { type: 'tool-call-input', toolCallId: 's3', input: { command: 'npm run build' } }, delay: 250 },
  { event: { type: 'tool-result', toolCallId: 's3', output: { ok: 'aborted' } }, delay: 250 },
  { stream: '最后这个工具停在审批中，行保持运行态与审批摘要。', as: 'text-delta' },
  { event: { type: 'tool-call-start', toolCallId: 's4', toolName: 'bash' } },
  { event: { type: 'tool-call-input', toolCallId: 's4', input: { command: 'rm -rf dist' } }, delay: 200 },
  { event: { type: 'approval-requested', toolCallId: 's4', level: 'confirm', args: { command: 'rm -rf dist' } }, delay: 0 },
]

export const fixtures: WorkbenchFixture[] = [
  {
    id: 'demo',
    name: '完整演示回合',
    description: 'read / bash（审批+流式输出）/ ask_questions 为示例渲染器，mcp__github__search_issues 落 Generic Fallback，write 演示错误行。示例渲染器只属于 playground，不随包分发。',
    script: demoConversation,
  },
  {
    id: 'states',
    name: '状态速览',
    description: '成功 / 错误 / 中断 三种终态 + 停在审批中的运行行。',
    script: statesOverview,
  },
]

export type { AgentEvent }
