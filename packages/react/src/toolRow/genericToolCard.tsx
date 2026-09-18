import { useMemo } from 'react'
import { ToolRow, GutterBlock, type ToolRowStatus } from './ToolRow'
import {
  toolNameLabel, formatResult, getOutputStatus, getOutputError,
  type ToolRenderProps, type StreamToolRenderProps,
} from '../toolHelpers'
import { deriveToolSummary, firstErrorLine, tryParseJson } from './toolCallModel'
import { useLoopT } from '../i18n'

function statusFromOutput(output: unknown | undefined): ToolRowStatus {
  if (output === undefined) return 'running'
  const status = getOutputStatus(output)
  if (status === 'error') return 'error'
  if (status === 'interrupted') return 'interrupted'
  return 'ok'
}

function errorLineFromOutput(output: unknown): string | undefined {
  const error = getOutputError(output)
  return error !== null ? firstErrorLine(error) : undefined
}

/**
 * The generic fallback card (dsh GenericToolCard + IN/OUT gutter view): every
 * unregistered tool — i.e. every MCP tool — renders through this instead of a
 * bare JSON dump. Variant-classified icon, one-line arg summary, error-first-
 * line in the collapsed head, and an IN/OUT gutter body with inner scroll.
 */
export function GenericToolCard({ calls, results }: ToolRenderProps) {
  const t = useLoopT()
  const first = calls[0]
  if (!first) return null

  // A uniform group renders as one row (existing Default behavior); the
  // mixed-name case never reaches a named renderer and lands here too.
  const groupTitle = calls.length === 1
    ? toolNameLabel(first.toolName)
    : t('tool.group', { count: calls.length })

  let groupStatus: ToolRowStatus = 'ok'
  let errorLine: string | undefined
  for (const call of calls) {
    const result = results[call.toolCallId]
    const output = result !== undefined ? tryParseJson(result) : undefined
    const status = statusFromOutput(output)
    if (status === 'error') { groupStatus = 'error'; errorLine = errorLineFromOutput(output) }
    else if (status === 'interrupted' && groupStatus !== 'error') groupStatus = 'interrupted'
    else if (status === 'running' && groupStatus === 'ok') groupStatus = 'running'
  }

  return (
    <ToolRow
      toolName={first.toolName}
      title={groupTitle}
      summary={calls.length === 1 ? deriveToolSummary(first.input) : undefined}
      status={groupStatus}
      errorLine={errorLine}
    >
      <div className="space-y-3">
        {calls.map(call => {
          const result = results[call.toolCallId]
          const output = result !== undefined ? tryParseJson(result) : undefined
          const failed = statusFromOutput(output) === 'error'
          return (
            <div key={call.toolCallId} className="space-y-2">
              <GutterBlock label="IN">{formatResult(JSON.stringify(call.input) ?? '')}</GutterBlock>
              {result !== undefined && (
                <GutterBlock label="OUT" error={failed}>
                  {formatResult(typeof output === 'string' ? output : JSON.stringify(output))}
                </GutterBlock>
              )}
            </div>
          )
        })}
      </div>
    </ToolRow>
  )
}

export function GenericStreamToolCard({ toolCall, streamingArgs, streamingOutput, toolResult, pendingApproval }: StreamToolRenderProps) {
  const t = useLoopT()
  // Tolerant mid-stream args: a truncated JSON string renders as raw text.
  const effectiveInput = useMemo(
    () => (streamingArgs !== undefined && streamingArgs !== '' ? tryParseJson(streamingArgs) : toolCall.input),
    [streamingArgs, toolCall.input],
  )

  let status: ToolRowStatus = 'running'
  if (toolResult !== undefined) status = statusFromOutput(toolResult.output)
  const errorLine = toolResult !== undefined ? errorLineFromOutput(toolResult.output) : undefined

  const summary = pendingApproval
    ? `${deriveToolSummary(effectiveInput)} — ${t('tool.awaitingApproval')}`.trim()
    : deriveToolSummary(effectiveInput)

  return (
    <ToolRow
      toolName={toolCall.toolName}
      summary={summary === '' ? undefined : summary}
      status={status}
      errorLine={errorLine}
    >
      <div className="space-y-2">
        <GutterBlock label="IN">{formatResult(JSON.stringify(effectiveInput) ?? '')}</GutterBlock>
        {toolResult !== undefined ? (
          <GutterBlock label="OUT" error={status === 'error'}>
            {formatResult(typeof toolResult.output === 'string' ? toolResult.output : JSON.stringify(toolResult.output))}
          </GutterBlock>
        ) : streamingOutput !== undefined && streamingOutput !== '' ? (
          <GutterBlock label="OUT">{streamingOutput}</GutterBlock>
        ) : null}
      </div>
    </ToolRow>
  )
}
