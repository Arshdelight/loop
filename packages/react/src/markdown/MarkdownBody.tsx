import { isValidElement, useMemo, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import { CodeBlock } from './CodeBlock'
import { normalizeLatexDelimiters } from './normalizeMath'
import { DiagramBlock } from './DiagramBlock'

/**
 * Markdown body on the remark stack (react-markdown + remark-gfm + remark-
 * math + rehype-katex + rehype-raw). Parsing correctness (nested lists,
 * tables, strikethrough, unclosed fences) comes from micromark — the same
 * parser dsh builds on — while everything visual stays loop's own React
 * components (CodeBlock, DiagramBlock, table/link styling).
 *
 * 自 practi 抽提（2026-09-18，来源 renderer/shared/components/markdown/
 * MarkdownBody.tsx）；components map 保持 props 暴露可替换。
 */

function extractText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (isValidElement(node)) {
    return extractText((node.props as { children?: ReactNode }).children)
  }
  return ''
}

/** Pull { lang, text } out of the <code> element react-markdown passed inside <pre>. */
function extractCodeBlock(children: ReactNode): { lang: string; text: string } | null {
  const child = Array.isArray(children) ? children[0] : children
  if (!isValidElement(child)) return null
  const props = child.props as { className?: string; children?: ReactNode }
  const lang = /language-(\S+)/.exec(props.className ?? '')?.[1]?.toLowerCase() ?? ''
  // remark keeps the fenced block's trailing newline; strip it so copy /
  // diagram keys match the hand parser's behavior.
  return { lang, text: extractText(props.children).replace(/\n$/, '') }
}

// Stable across renders: a fresh components map each render makes React treat
// every block as a new component type and REMOUNT the whole markdown subtree
// (wiping mermaid's processed SVG) on any parent re-render.
const STATIC_COMPONENTS: Components = {
  code: ({ className, children }: { className?: string; children?: ReactNode }) => (
    <code className={`bg-hover px-1 py-0.5 rounded text-sm font-mono ${className ?? ''}`}>{children}</code>
  ),
  p: ({ children }) => <p className="my-1">{children}</p>,
  h1: ({ children }) => <h1 className="text-2xl font-bold my-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-bold my-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-lg font-bold my-2">{children}</h3>,
  h4: ({ children }) => <h4 className="text-base font-bold my-2">{children}</h4>,
  h5: ({ children }) => <h5 className="text-sm font-bold my-2">{children}</h5>,
  h6: ({ children }) => <h6 className="text-xs font-bold my-2">{children}</h6>,
  ul: ({ children }) => <ul className="my-1 pl-5 list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="my-1 pl-5 list-decimal">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="border-l-4 border-muted/30 pl-3 my-1 text-muted">{children}</blockquote>,
  hr: () => <hr className="my-3 border-line" />,
  a: ({ href, children }) => <a href={href} className="text-accent underline">{children}</a>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border-collapse border border-line">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-line px-3 py-1.5 text-left text-sm font-medium bg-hover">{children}</th>,
  td: ({ children }) => <td className="border border-line px-3 py-1.5 text-sm">{children}</td>,
}

export interface MarkdownBodyProps {
  content: string
  /** Streaming output — shows a blinking cursor (and keeps mermaid as code). */
  cursor?: boolean
  /** Any in-progress stream entry (mermaid must stay code until final). */
  streaming?: boolean
  /** 覆盖任意元素的渲染（components map 暴露给下游替换）。 */
  components?: Components
}

/** The streaming caret, injected INLINE at the tail of the markdown source so
 *  it lands at the end of the last rendered line (rehype-raw keeps it inside
 *  the final paragraph). A block-level sibling after <ReactMarkdown> would sit
 *  BELOW the last block — one line too low. */
const CURSOR_HTML = '<stream-cursor></stream-cursor>'

/** The caret can ride inline only when the source is NOT mid-code-fence or
 *  ending on a closing fence — there it would corrupt the block (or render as
 *  literal text), so the caller falls back to the block-level caret. */
function cursorCanRideInline(source: string): boolean {
  const fences = source.match(/^`{3,}/gm)
  if (fences !== null && fences.length % 2 !== 0) return false
  return !/(^|\n)\s*```[^\n]*$/.test(source.trimEnd())
}

export function MarkdownBody({ content, cursor, streaming, components: componentOverrides }: MarkdownBodyProps) {
  const isStreaming = !!cursor || !!streaming

  // The `pre` dispatcher depends on isStreaming, so its identity flips at
  // stream start/end only — everything else stays mounted across renders.
  const components = useMemo<Components>(() => ({
    ...STATIC_COMPONENTS,
    ...componentOverrides,
    pre: ({ children }) => {
      const block = extractCodeBlock(children)
      if (!block) return <pre>{children}</pre>
      // Keyed by content: an edited message reuses the component instance
      // otherwise, and React's stale text-node reference (mermaid replaced
      // the node's children) would keep the OLD diagram rendered forever.
      if (!isStreaming && (block.lang === 'mermaid' || block.lang === 'svg')) {
        return <DiagramBlock key={block.text} code={block.text} language={block.lang} />
      }
      return <CodeBlock key={block.text} code={block.text} language={block.lang} />
    },
    'stream-cursor': () => <span className="inline-block w-1.5 h-4 bg-main/50 ml-0.5 animate-pulse rounded-sm align-middle" />,
  } as Components), [isStreaming, componentOverrides])

  const normalized = normalizeLatexDelimiters(content)
  const inlineCaret = cursor && cursorCanRideInline(normalized)

  return (
    <>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={components}
      >
        {inlineCaret ? normalized + CURSOR_HTML : normalized}
      </ReactMarkdown>
      {cursor && !inlineCaret && <span className="inline-block w-1.5 h-4 bg-main/50 ml-0.5 animate-pulse rounded-sm" />}
    </>
  )
}
