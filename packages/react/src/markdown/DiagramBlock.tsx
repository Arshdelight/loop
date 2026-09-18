import { useEffect, useRef, useState } from 'react'
import { Code2, Image } from 'lucide-react'
import { ensureMermaid } from './mermaidLoader'
import { CodeBlock } from './CodeBlock'
import { useLoopT } from '../i18n'

/**
 * A FINAL mermaid/svg block — the diagram itself with a "view source" toggle
 * in the corner. Streaming partials render as plain CodeBlock instead (the
 * dispatch lives in MarkdownBody's `pre` override).
 *
 * The .mermaid node is a plain React text child that mermaid.run() post-
 * processes in place; React never re-owns that subtree, so a parent re-render
 * cannot wipe the processed SVG back to source. The per-render effect below
 * still re-runs mermaid for nodes that React DID recreate (content edits),
 * skipping processed ones.
 */
export function DiagramBlock({ code, language }: { code: string; language: string }) {
  const t = useLoopT()
  const [viewSource, setViewSource] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const runningRef = useRef(false)

  useEffect(() => {
    if (language !== 'mermaid') return
    const c = containerRef.current
    if (!c || runningRef.current) return
    const nodes = c.querySelectorAll<HTMLElement>('.mermaid:not([data-processed])')
    if (nodes.length === 0) return
    runningRef.current = true
    ensureMermaid().then(m => m.run({ nodes: Array.from(nodes) }))
      .catch(() => { /* parse errors mark the node processed; nothing to retry */ })
      .then(() => { runningRef.current = false })
  })

  if (viewSource) {
    return (
      <CodeBlock
        code={code}
        language={language}
        headerAction={
          <button
            onClick={() => setViewSource(false)}
            aria-label={t('code.showDiagram')}
            className="flex items-center justify-center size-5 rounded-md text-muted hover:text-main hover:bg-hover transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
          >
            <Image className="size-3" />
          </button>
        }
      />
    )
  }

  return (
    <div className="group my-2 relative">
      <div ref={containerRef} className="overflow-x-auto p-3 flex justify-center">
        {language === 'svg' ? (
          // Raw svg passthrough (local app, LLM/user-owned content);
          // react-markdown's urlTransform still sanitizes href/src inside.
          <div className="diagram-svg" dangerouslySetInnerHTML={{ __html: code }} />
        ) : (
          <div className="mermaid">{code}</div>
        )}
      </div>
      <button
        onClick={() => setViewSource(true)}
        aria-label={t('code.viewSource')}
        className="absolute top-1 right-1 z-10 flex items-center justify-center size-6 rounded-md bg-surface/90 border border-line/30 text-muted hover:text-main hover:bg-hover transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer"
      >
        <Code2 className="size-3.5" />
      </button>
    </div>
  )
}
