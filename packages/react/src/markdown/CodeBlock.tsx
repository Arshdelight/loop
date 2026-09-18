import { useState, type ReactNode } from 'react'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { Check, Copy } from 'lucide-react'
import { useLoopT } from '../i18n'

function highlightCode(code: string, language: string): { html: string; detectedLang: string } {
  if (language && hljs.getLanguage(language)) {
    return { html: hljs.highlight(code, { language }).value, detectedLang: language }
  }
  const result = hljs.highlightAuto(code)
  return { html: result.value, detectedLang: result.relevance >= 3 ? result.language ?? '' : '' }
}

export function CodeBlock({ code, language, headerAction }: {
  code: string
  language: string
  /** Extra control in the language-label row (e.g. a diagram's "back to view"). */
  headerAction?: ReactNode
}) {
  const t = useLoopT()
  const [copied, setCopied] = useState(false)
  const { html: highlighted, detectedLang } = highlightCode(code, language)
  const hasHeader = !!(detectedLang || headerAction)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable (e.g. non-secure context) — leave button as-is
    }
  }

  // The header row (language label + optional action like "back to diagram")
  // is flex so the action sits on the same line as the label, and the copy
  // button stays inside the pre — no overlap. The wrapper div is the hover
  // group for the copy / action buttons.
  return (
    <div className="group relative my-2">
      {hasHeader && (
        <div className={`flex items-center ${detectedLang ? 'justify-between gap-2' : 'justify-end'} text-[10px] font-mono text-muted/80 bg-hover/60 border-b border-line/30 px-3 py-1 select-none rounded-t-lg`}>
          <span>{detectedLang}</span>
          {headerAction}
        </div>
      )}
      <pre className={`relative bg-hover p-3 rounded-lg overflow-x-auto text-sm leading-relaxed${hasHeader ? ' rounded-t-none mt-0' : ''}`}>
        <button
          onClick={onCopy}
          aria-label={t('code.copy')}
          className="absolute top-1.5 right-1.5 z-10 flex items-center justify-center size-6 rounded-md bg-hover/80 border border-line/30 text-muted hover:text-main hover:bg-hover transition-opacity opacity-0 group-hover:opacity-100 cursor-pointer"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
        {/* highlight.js output is pre-escaped HTML spans */}
        <code className="font-mono hljs" style={{ background: 'transparent', padding: 0 }} dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  )
}
