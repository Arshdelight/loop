import { ToolRow, GutterBlock, registerStreamToolRenderer, tryParseJson } from '@arshdelight/loop-react'
import { Check } from 'lucide-react'
import type { StreamToolRenderProps } from '@arshdelight/loop-react'

/**
 * Playground 的演示渲染器注册——这就是「下游应用注册新工具渲染器」的用法：
 * import '@arshdelight/loop-react' 之后按工具名注册专属卡，未注册的工具
 * 自动落到 Generic Fallback（见 fixture 里的 mcp__github__search_issues）。
 */

interface AskQuestionsOutput {
  ok: string
  questions?: Array<{ id: string; question: string; options: string[]; answer?: string }>
}

/** ask_questions：表单卡——问题 + 选项，已作答的选项高亮。 */
function AskQuestionsCard({ toolCall, streamingArgs, toolResult }: StreamToolRenderProps) {
  const input = streamingArgs !== undefined && streamingArgs !== ''
    ? tryParseJson(streamingArgs)
    : toolCall.input
  const output = toolResult?.output as AskQuestionsOutput | undefined
  const questions = (output?.questions ?? (input as { questions?: AskQuestionsOutput['questions'] })?.questions) ?? []
  return (
    <ToolRow
      toolName={toolCall.toolName}
      status={toolResult !== undefined ? 'ok' : 'running'}
      defaultOpen={toolResult !== undefined}
    >
      <div className="space-y-3 py-1">
        {questions.map((q, i) => (
          <div key={q.id ?? i} className="text-sm">
            <div className="text-main mb-1.5">{q.question}</div>
            <div className="flex flex-col gap-1">
              {q.options.map((opt) => {
                const chosen = q.answer === opt
                return (
                  <div
                    key={opt}
                    className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-muted ${
                      chosen ? 'border-yellow-500/50 bg-yellow-500/10 text-main' : 'border-line'
                    }`}
                  >
                    {chosen && <Check className="size-3.5 shrink-0 text-yellow-500" />}
                    <span className="truncate">{opt}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </ToolRow>
  )
}

/** read：IN 是路径，OUT 是文件内容（等宽小字）。 */
function ReadCard({ toolCall, toolResult, streamingArgs }: StreamToolRenderProps) {
  const input = streamingArgs !== undefined && streamingArgs !== ''
    ? tryParseJson(streamingArgs)
    : toolCall.input
  const content = (toolResult?.output as { content?: string } | undefined)?.content
  return (
    <ToolRow
      toolName={toolCall.toolName}
      input={input}
      status={toolResult !== undefined ? 'ok' : 'running'}
    >
      {content !== undefined && (
        <GutterBlock label="OUT">
          {content.split('\n').slice(0, 12).join('\n')}
          {content.split('\n').length > 12 ? '\n…' : ''}
        </GutterBlock>
      )}
    </ToolRow>
  )
}

/** bash：终端风卡片——自带深色底面（rail=false），流式输出期间实时追加。 */
function BashCard({ toolCall, toolResult, streamingArgs, streamingOutput, pendingApproval }: StreamToolRenderProps) {
  const input = streamingArgs !== undefined && streamingArgs !== ''
    ? tryParseJson(streamingArgs)
    : toolCall.input
  const command = (input as { command?: string } | undefined)?.command ?? ''
  const stdout = (toolResult?.output as { stdout?: string } | undefined)?.stdout ?? streamingOutput ?? ''
  const failed = (toolResult?.output as { ok?: string } | undefined)?.ok === 'error'
  return (
    <ToolRow
      toolName={toolCall.toolName}
      summary={pendingApproval ? `${command} — ${pendingApproval.level ?? ''}` : command}
      status={toolResult !== undefined ? (failed ? 'error' : 'ok') : 'running'}
      rail={false}
    >
      <div className="rounded-md bg-black/40 border border-line px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-muted">
        <div className="text-main/80">$ {command}</div>
        {stdout !== '' && <div className="mt-1">{stdout}</div>}
      </div>
    </ToolRow>
  )
}

export function registerDemoRenderers() {
  registerStreamToolRenderer('ask_questions', AskQuestionsCard)
  registerStreamToolRenderer('read', ReadCard)
  registerStreamToolRenderer('bash', BashCard)
}
