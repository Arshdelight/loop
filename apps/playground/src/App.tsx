import { useCallback, useEffect, useRef, useState, useReducer } from 'react'
import { applyAgentEvent, type AgentEvent, type StreamEntry } from '@arshdelight/loop-core'
import { LoopLabelsProvider, StreamEntriesView } from '@arshdelight/loop-react'
import { demoConversation } from './fixtures/conversation'
import { replayEvents, type ReplayHandle } from './replay'
import { registerDemoRenderers } from './renderers'

registerDemoRenderers()

/** useReducer 包装：在 AgentEvent 之上加一个 reset 动作（type 值不冲突）。 */
function reducerWithReset(state: StreamEntry[], action: AgentEvent | { type: 'reset' }): StreamEntry[] {
  return action.type === 'reset' ? [] : applyAgentEvent(state, action)
}

export function App() {
  const [entries, dispatch] = useReducer(reducerWithReset, [] as StreamEntry[])
  const [running, setRunning] = useState(false)
  const replayRef = useRef<ReplayHandle | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const onEvent = useCallback((event: AgentEvent) => {
    dispatch(event)
  }, [])

  const start = useCallback(() => {
    replayRef.current?.cancel()
    dispatch({ type: 'reset' })
    setRunning(true)
    const handle = replayEvents(demoConversation, onEvent)
    replayRef.current = handle
    void handle.done.then(() => setRunning(false))
  }, [onEvent])

  useEffect(() => () => replayRef.current?.cancel(), [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries])

  return (
    <LoopLabelsProvider labels={{ thought: '思考', awaitingApproval: '等待确认', toolCalls: n => `${n} 个工具调用` }}>
      <div className="min-h-screen text-main">
        <div className="mx-auto max-w-[46rem] px-5 py-10">
          <header className="mb-6">
            <h1 className="text-lg font-semibold">loop playground</h1>
            <p className="text-sm text-muted mt-1">
              fixture 事件流回放驱动 @arshdelight/loop-react：read / bash（审批+流式输出）/ ask_questions 为已注册专属渲染器，
              mcp__github__search_issues 落 Generic Fallback，write 演示错误行。
            </p>
          </header>

          <div className="flex gap-2 mb-6">
            <button
              onClick={start}
              disabled={running}
              className="rounded-md border border-line px-4 py-1.5 text-sm text-main hover:bg-white/5 disabled:opacity-40 disabled:cursor-default transition-colors"
            >
              {running ? '回放中…' : '回放演示回合'}
            </button>
            <button
              onClick={() => { replayRef.current?.cancel(); setRunning(false); dispatch({ type: 'reset' }) }}
              className="rounded-md border border-line px-4 py-1.5 text-sm text-muted hover:bg-white/5 transition-colors"
            >
              重置
            </button>
          </div>

          <StreamEntriesView entries={entries} reasoningRunning={running} />
          <div ref={bottomRef} />
        </div>
      </div>
    </LoopLabelsProvider>
  )
}
