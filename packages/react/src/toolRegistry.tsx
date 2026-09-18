import { useState, useRef, useEffect, type ReactNode, type ComponentType } from 'react'
import { Lightbulb, ChevronRight } from 'lucide-react'
import { getReasoningExpanded, setReasoningExpanded } from './reasoningUiState'
import { GenericToolCard, GenericStreamToolCard } from './toolRow/genericToolCard'
import { useLoopT } from './i18n'

// Pure helpers + render-prop types live in toolHelpers.ts (kept re-exported
// here so renderers can import everything from one place); all cards render
// through the dsh-style ToolRow shell in toolRow/.
export {
  toolNameLabel, registerToolLabel, formatResult,
  getResultStatus, getOutputStatus, getResultError, getResultInterrupted,
  getOutputError, getOutputInterrupted,
  type ToolResultStatus, type ToolRenderProps, type StreamToolRenderProps,
} from './toolHelpers'

import type { ToolRenderProps, StreamToolRenderProps } from './toolHelpers'

type ToolRendererFn = (props: ToolRenderProps) => ReactNode
type StreamToolRendererFn = (props: StreamToolRenderProps) => ReactNode

const toolRendererComponents: Record<string, ComponentType<ToolRenderProps>> = {}

/** 注册 settled 工具渲染器（下游注册新工具专属卡片的入口之一）。 */
export function registerToolRenderer(toolName: string, renderer: ToolRendererFn) {
  toolRendererComponents[toolName] = (props: ToolRenderProps) => renderer(props) as React.ReactElement
}

const streamToolRendererComponents: Record<string, ComponentType<StreamToolRenderProps>> = {}

/** 注册流式工具渲染器（带 streamingArgs / streamingOutput / 审批态）。 */
export function registerStreamToolRenderer(toolName: string, renderer: StreamToolRendererFn) {
  streamToolRendererComponents[toolName] = (props: StreamToolRenderProps) => renderer(props) as React.ReactElement
}

/** dsh Think row: a settled reasoning block summarizes its FIRST line; the
 *  streaming tail summarizes the line currently being written. */
function reasoningFirstLine(text: string): string {
  const newline = text.indexOf('\n')
  return newline === -1 ? text : text.slice(0, newline)
}

function reasoningLatestLine(text: string): string {
  const visible = text.trimEnd()
  const newline = visible.lastIndexOf('\n')
  return newline === -1 ? visible : visible.slice(newline + 1)
}

export function ReasoningBlock({ label, content, defaultExpanded, stateKey, running = false }: {
  label?: string
  content: string
  defaultExpanded?: boolean
  /** Shared-expansion key (conversationId + block index). When provided the
   *  expanded state is read/written through reasoningUiState so it survives the
   *  streaming → completed transition; without it local state is used. */
  stateKey?: string
  /** This block is the live streaming tail (dsh Think): the collapsed row
   *  carries the running sweep and summarizes the line currently being
   *  written, scrolling to keep its end visible; a settled block shows its
   *  first line, ellipsized. */
  running?: boolean
}) {
  const t = useLoopT()
  const [expanded, setExpanded] = useState(
    stateKey !== undefined ? getReasoningExpanded(stateKey) : (defaultExpanded ?? false),
  )
  const scrollRef = useRef<HTMLDivElement>(null)
  const userScrolledUpRef = useRef(false)
  const summaryRef = useRef<HTMLSpanElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  // Per-instance random phase, same as ToolRow's.
  const [sweepPhase] = useState(() => -Math.random() * 2.6)
  // Sweep-out: 同 ToolRow——流式结束时原地淡出 300ms，不中途截断。
  const [sweeping, setSweeping] = useState(running)
  const [sweepOut, setSweepOut] = useState(false)
  useEffect(() => {
    if (running) { setSweepOut(false); setSweeping(true); return }
    const el = btnRef.current
    if (el === null) { setSweeping(false); return }
    const finish = () => setSweeping(false)
    const onEnd = (e: TransitionEvent) => {
      if (e.pseudoElement === '::after' && e.propertyName === 'opacity') finish()
    }
    setSweepOut(true)
    el.addEventListener('transitionend', onEnd)
    const timer = setTimeout(finish, 500)
    return () => {
      el.removeEventListener('transitionend', onEnd)
      clearTimeout(timer)
    }
  }, [running])

  useEffect(() => {
    if (expanded && scrollRef.current && !userScrolledUpRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [content, expanded])

  const summary = running ? reasoningLatestLine(content) : reasoningFirstLine(content)
  // Follow the tail: keep the growing line's end scrolled into view while the
  // block is the streaming tail (clip, not ellipsis, so the writing edge shows).
  useEffect(() => {
    if (!running || expanded) return
    const el = summaryRef.current
    if (el) el.scrollLeft = el.scrollWidth - el.clientWidth
  }, [summary, running, expanded])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const el = scrollRef.current
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30
    userScrolledUpRef.current = !isAtBottom
  }

  const toggleExpanded = () => {
    const next = !expanded
    setExpanded(next)
    if (stateKey !== undefined) setReasoningExpanded(stateKey, next)
  }

  return (
    <div className="flex justify-start mb-2">
      <div className="w-full">
        <button
          ref={btnRef}
          onClick={toggleExpanded}
          className={`group flex items-center gap-2 w-full py-1.5 text-sm text-left text-muted hover:text-main transition-colors cursor-pointer ${sweeping ? 'tool-row-running-sweep' : ''} ${sweeping && sweepOut ? 'tool-row-sweep-out' : ''}`}
          style={sweeping ? ({ '--sweep-delay': `${sweepPhase.toFixed(2)}s` } as React.CSSProperties) : undefined}
        >
          <span className="relative block size-4 shrink-0">
            <Lightbulb className="size-4 transition-opacity group-hover:opacity-0" />
            <ChevronRight className={`absolute inset-0 size-4 transition-all opacity-0 group-hover:opacity-100 ${expanded ? 'rotate-90' : ''}`} />
          </span>
          <span className={`shrink-0 ${running ? 'text-main' : ''}`}>{label ?? t('reasoning.thought')}</span>
          {!expanded && (
            <span
              ref={summaryRef}
              className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap opacity-70 ${running ? '' : 'truncate'}`}
              style={running ? { textOverflow: 'clip' } : undefined}
            >
              {summary}
            </span>
          )}
        </button>
        {expanded && (
          <div className="pl-4 py-2 overflow-visible">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className={`border-l-2 border-line/40 pl-3 py-1 text-sm text-muted whitespace-pre-wrap overflow-y-auto ${defaultExpanded ? 'max-h-[4.5em]' : ''}`}
            >
              {content}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** settled 多条同组调用的分发器：注册表命中走专属卡，否则 Generic 兜底。 */
export function ToolRenderer(props: ToolRenderProps) {
  const first = props.calls[0]
  if (first === undefined) return null

  const allSame = props.calls.every(c => c.toolName === first.toolName)
  if (allSame) {
    const Comp = toolRendererComponents[first.toolName]
    if (Comp) return <Comp {...props} />
  }

  return <GenericToolCard {...props} />
}

/** 流式单条调用的分发器：注册表命中走专属卡，否则 Generic 兜底。 */
export function StreamToolRenderer(props: StreamToolRenderProps) {
  const Comp = streamToolRendererComponents[props.toolCall.toolName]
  if (Comp) return <Comp {...props} />
  return <GenericStreamToolCard {...props} />
}
