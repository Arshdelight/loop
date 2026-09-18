import { useCallback, useEffect, useRef, useState, useReducer } from 'react'
import { applyAgentEvent, type AgentEvent, type StreamEntry } from '@arshdelight/loop-core'
import { LoopI18nProvider } from '../i18n'
import type { LoopLang } from '../i18nCore'
import { StreamEntriesView } from '../streamEntriesView'
import { replayEvents, type ReplayHandle, type ReplayItem } from './replay'

export interface WorkbenchFixture {
  id: string
  name: string
  description?: string
  script: ReplayItem[]
}

type ThemeMode = 'system' | 'light' | 'dark'

/** useReducer 包装：在 AgentEvent 之上加一个 reset 动作（type 值不冲突）。 */
function reducerWithReset(state: StreamEntry[], action: AgentEvent | { type: 'reset' }): StreamEntry[] {
  return action.type === 'reset' ? [] : applyAgentEvent(state, action)
}

/**
 * 渲染器预览工作台（workbench 子模块）——下游的「渲染器 view」：
 * 在自己项目的 dev 页面挂载 <RendererWorkbench fixtures={...} />，
 * 注册好的工具渲染器 + fixture 事件脚本即可离线预览（不调真实模型）。
 * 自带主题（跟随系统/亮/暗）与语言（中/英）切换、回放速度控制。
 */
export function RendererWorkbench({ fixtures, title = 'loop renderer workbench', initialFixtureId }: {
  fixtures: WorkbenchFixture[]
  title?: string
  initialFixtureId?: string
}) {
  const [theme, setTheme] = useState<ThemeMode>('system')
  const [lang, setLang] = useState<LoopLang>('zh')
  const [speed, setSpeed] = useState(1)
  const [fixtureId, setFixtureId] = useState(
    () => initialFixtureId ?? fixtures[0]?.id ?? '')
  const [entries, dispatch] = useReducer(reducerWithReset, [] as StreamEntry[])
  const [running, setRunning] = useState(false)
  const replayRef = useRef<ReplayHandle | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fixture = fixtures.find(f => f.id === fixtureId) ?? fixtures[0]

  useEffect(() => {
    const el = document.documentElement
    if (theme === 'system') delete el.dataset.loopTheme
    else el.dataset.loopTheme = theme
  }, [theme])

  useEffect(() => () => replayRef.current?.cancel(), [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries])

  const stop = useCallback(() => {
    replayRef.current?.cancel()
    setRunning(false)
  }, [])

  const start = useCallback(() => {
    if (fixture === undefined) return
    replayRef.current?.cancel()
    dispatch({ type: 'reset' })
    setRunning(true)
    const handle = replayEvents(fixture.script, dispatch, { speed })
    replayRef.current = handle
    void handle.done.then(() => setRunning(false))
  }, [fixture, speed])

  return (
    <LoopI18nProvider lang={lang}>
      <div className="min-h-screen text-main">
        <div className="mx-auto max-w-[50rem] px-5 py-8">
          <header className="mb-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h1 className="text-lg font-semibold">{title}</h1>
              <div className="flex gap-2">
                <Segmented
                  options={[['system', '跟随系统'], ['light', '亮色'], ['dark', '暗色']] as Array<[ThemeMode, string]>}
                  value={theme} onChange={setTheme} />
                <Segmented
                  options={[['zh', '中'], ['en', 'EN']] as Array<[LoopLang, string]>}
                  value={lang} onChange={setLang} />
              </div>
            </div>
            {fixture?.description !== undefined && (
              <p className="text-sm text-muted mt-1">{fixture.description}</p>
            )}
          </header>

          <div className="flex flex-wrap gap-2 mb-3">
            {fixtures.map(f => (
              <button
                key={f.id}
                onClick={() => { stop(); setFixtureId(f.id) }}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  f.id === fixture?.id
                    ? 'border-main/40 bg-main/10 text-main'
                    : 'border-line text-muted hover:text-main'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={start}
              disabled={running || fixture === undefined}
              className="rounded-md border border-line px-4 py-1.5 text-sm text-main hover:bg-main/5 disabled:opacity-40 disabled:cursor-default transition-colors"
            >
              {running ? '回放中…' : '回放'}
            </button>
            <button
              onClick={() => { stop(); dispatch({ type: 'reset' }) }}
              className="rounded-md border border-line px-4 py-1.5 text-sm text-muted hover:bg-main/5 transition-colors"
            >
              重置
            </button>
            <Segmented
              options={[[1, '1x'], [2, '2x'], [4, '4x']] as Array<[number, string]>}
              value={speed} onChange={setSpeed} />
          </div>

          <StreamEntriesView entries={entries} streaming={running} />
          <div ref={bottomRef} />
        </div>
      </div>
    </LoopI18nProvider>
  )
}

function Segmented<T extends string | number>({ options, value, onChange }: {
  options: Array<[T, string]>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-md border border-line overflow-hidden text-xs">
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className={`px-2.5 py-1.5 transition-colors ${
            v === value ? 'bg-main text-[var(--loop-bg)]' : 'text-muted hover:text-main'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
