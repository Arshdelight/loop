import { useState, useEffect, useRef, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import { ChevronRight, AlertCircle } from 'lucide-react'
import { ToolIcon } from './toolIcon'
import { deriveToolSummary } from './toolCallModel'
import { toolNameLabel } from '../toolHelpers'
import { useSweepDuration } from './useSweep'

export type ToolRowStatus = 'running' | 'ok' | 'error' | 'interrupted'

export interface ToolRowProps {
  toolName: string
  /** Explicit icon override (defaults to the variant icon for toolName). */
  icon?: ComponentType<{ className?: string }>
  /** Row title; defaults to the friendly tool label. */
  title?: string
  /** One-line summary shown after the title. Defaults to deriveToolSummary(input). */
  summary?: string
  /** Argument object the default summary is derived from. */
  input?: unknown
  status: ToolRowStatus
  /** Error first line — replaces the summary and renders in error color. */
  errorLine?: string
  defaultOpen?: boolean
  /** Fully-controlled open state; omit for internal state. */
  open?: boolean
  onToggle?: (next: boolean) => void
  /** Row-level action for NON-expandable rows (no children): the whole row
   *  becomes the button (e.g. a sub-agent delegation opening its sidebar
   *  view). Ignored when the row expands. */
  onRowClick?: () => void
  /** Expanded body. The shell provides the indent rail and inner scroll. */
  children?: ReactNode
  /** Right-edge status icon override (replaces the state-derived one). */
  statusIcon?: ReactNode
  /** Inline action affordances — rendered right AFTER the row's left-aligned
   *  content, as a sibling of the toggle button: real focusable buttons that
   *  don't toggle expansion. The row's remaining width stays click-to-toggle. */
  actions?: ReactNode
  /** Draw the expanded body's left guide rail (default true). Cards that
   *  bring their own surface (the terminal card) pass false for a flush body. */
  rail?: boolean
}

/**
 * dsh-style disclosure row shell (ToolRow): variant icon → chevron on hover,
 * `title · summary` on one line, whole row toggles expansion (click, Enter,
 * Space), collapsed by default. While running, the title is drawn in the main
 * (near-black) text color — the in-flight call is the thing to watch — and
 * settles back to muted when the call ends; the row carries a looping narrow
 * white sweep (no fabricated duration); a failed call swaps the summary for
 * the error's first line in error color and keeps its amber alert mark (a
 * successful call renders no trailing mark). The expanded body scrolls inside
 * a max-height container.
 */
export function ToolRow({
  toolName, icon: IconOverride, title, summary, input, status, errorLine,
  defaultOpen = false, open, onToggle, onRowClick, children, statusIcon, rail = true, actions,
}: ToolRowProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  // Per-instance random phase (negative delay) for the running sweep: rows
  // that start together would otherwise sweep in perfect lockstep and read
  // as a glitch column instead of independent in-flight signals.
  const [sweepPhase] = useState(() => -Math.random() * 2.6)
  const btnRef = useRef<HTMLButtonElement>(null)
  const running = status === 'running'
  const sweepDuration = useSweepDuration(btnRef)
  // Sweep-out: when the call settles mid-flight the band fades out in place
  // over 300ms (the animation keeps running underneath) instead of cutting
  // mid-stroke or waiting for a random-phase iteration boundary. The class is
  // fully removed after the fade; a timeout backs up transitionend in case the
  // event is missed.
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
  const expanded = open ?? internalOpen
  // No children → static row (dsh's noExpand headers): no chevron, no toggle —
  // but a non-expandable row may still carry a row-level action (onRowClick).
  const expandable = children !== undefined
  const rowAction = !expandable ? onRowClick : undefined
  const toggle = () => {
    if (rowAction) { rowAction(); return }
    if (!expandable) return
    const next = !expanded
    setInternalOpen(next)
    onToggle?.(next)
  }

  const label = title ?? toolNameLabel(toolName)
  const derivedSummary = summary ?? deriveToolSummary(input)
  const failed = status === 'error'

  // No trailing icon on success — a completed call needs no mark; failures
  // and interruptions keep their amber alert. Running carries NO trailing
  // spinner either: the row's sweep animation is the in-flight signal.
  const trailing = statusIcon
    ?? (failed || status === 'interrupted' ? (
      <AlertCircle className="size-3.5 shrink-0 text-yellow-500" />
    ) : undefined)

  return (
    <div className="flex justify-start mb-2">
      <div className="w-full min-w-0">
        {/* The wrapper carries the hover group so the chevron swap works
            anywhere on the row; the flex-1 spacer after any actions keeps the
            empty area clickable. The running sweep lives on the content-width
            BUTTON only — the band sweeps across the row's content (icon ·
            title · summary), not the full line. */}
        <div
          className="group flex items-center w-full"
        >
          <button
            ref={btnRef}
            onClick={toggle}
            className={`flex items-center gap-2 min-w-0 py-1.5 text-sm text-muted hover:text-main transition-colors text-left ${(expandable || rowAction) ? 'cursor-pointer' : 'cursor-default'} ${sweeping ? 'tool-row-running-sweep' : ''} ${sweeping && sweepOut ? 'tool-row-sweep-out' : ''}`}
            style={sweeping ? ({ '--sweep-delay': `${sweepPhase.toFixed(2)}s`, '--sweep-duration': sweepDuration } as CSSProperties) : undefined}
          >
            <span className="relative flex items-center justify-center size-4 shrink-0 rounded-sm">

              {IconOverride !== undefined ? (
                <IconOverride className={`size-4 ${expandable ? 'transition-opacity group-hover:opacity-0' : ''} ${failed ? 'text-yellow-500' : ''}`} />
              ) : (
                <ToolIcon name={toolName} className={`size-4 ${expandable ? 'transition-opacity group-hover:opacity-0' : ''} ${failed ? 'text-yellow-500' : ''}`} />
              )}
              {expandable && (
                <ChevronRight className={`absolute inset-0 size-4 transition-all opacity-0 group-hover:opacity-100 ${expanded ? 'rotate-90' : ''}`} />
              )}
            </span>
            <span className={`shrink-0 ${running ? 'text-main' : ''}`}>{label}</span>
            {failed && errorLine ? (
              <span className="truncate text-yellow-600 dark:text-yellow-400">{errorLine}</span>
            ) : derivedSummary ? (
              <span className="truncate opacity-70 min-w-0">{derivedSummary}</span>
            ) : null}
            {trailing}
          </button>
          {actions !== undefined && (
            <div className="flex items-center shrink-0 pl-1.5">{actions}</div>
          )}
          <div
            onClick={expandable ? toggle : undefined}
            className={`flex-1 self-stretch ${expandable ? 'cursor-pointer' : ''}`}
          />
        </div>
        {expanded && children !== undefined && (
          <div className={rail ? 'pl-4 border-l-2 border-line/40 py-2 max-h-72 overflow-y-auto' : 'py-2'}>
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

/** Left-gutter labeled block (dsh's IN/OUT card layout). */
export function GutterBlock({ label, children, error }: {
  label: string
  children: ReactNode
  error?: boolean
}) {
  return (
    <div className="grid grid-cols-[2.75rem_1fr] gap-x-2 font-mono text-xs leading-relaxed">
      <div className="text-right text-muted/50 select-none">{label}</div>
      <div className={`whitespace-pre-wrap break-all min-w-0 ${error ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted/80'}`}>
        {children}
      </div>
    </div>
  )
}
