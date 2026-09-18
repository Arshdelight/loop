import type { ReactNode } from 'react'
import type { StreamEntry, ToolEntry } from '@arshdelight/loop-core'
import { ReasoningBlock, StreamToolRenderer } from './toolRegistry'

/**
 * ToolEntry → StreamToolRenderProps 的桥：把 core 的归并条目翻译成
 * 渲染器注册表的 props 契约，下游不需要手工组装。
 */
export function ToolEntryView({ entry }: { entry: ToolEntry }) {
  return (
    <StreamToolRenderer
      toolCall={{ toolCallId: entry.toolCallId, toolName: entry.toolName, input: entry.input }}
      streamingArgs={entry.streamingArgs}
      streamingOutput={entry.streamingOutput}
      toolResult={entry.output !== undefined
        ? { toolCallId: entry.toolCallId, toolName: entry.toolName, output: entry.output }
        : undefined}
      pendingApproval={entry.pendingApproval}
    />
  )
}

/**
 * 直接渲染一条 AgentEventStream 归并出的 StreamEntry[]：思考走
 * ReasoningBlock、工具走注册表分发、文本/错误走内置块。这是下游
 * 「最快建立 agent 应用」的一行组件；文本块当前是 pre-wrap 占位，
 * markdown 渲染器（practi MarkdownBody 系）接入后由此替换。
 */
export function StreamEntriesView({ entries, streaming }: {
  entries: StreamEntry[]
  /** 会话是否仍在流式进行中——只有它 + 作为最后一个元素才让思考块带 running 动效。 */
  streaming?: boolean
}) {
  // running 态只属于「流式尾巴」：列表的最后一个元素（且会话仍在进行）。
  // 思考块流完、后面出现了正文或工具后，它就不再是尾巴，动效立即停止。
  const lastIdx = entries.length - 1
  return (
    <div className="w-full">
      {entries.map((entry, i) => {
        let node: ReactNode = null
        switch (entry.kind) {
          case 'reasoning':
            node = (
              <ReasoningBlock
                key={i}
                content={entry.text}
                running={streaming === true && i === lastIdx}
              />
            )
            break
          case 'text':
            node = <TextBlock key={i}>{entry.text}</TextBlock>
            break
          case 'tool':
            node = <ToolEntryView key={entry.toolCallId} entry={entry} />
            break
          case 'error':
            node = <ErrorBlock key={i}>{entry.text}</ErrorBlock>
            break
        }
        return node
      })}
    </div>
  )
}

/** 文本块（markdown 渲染器接入前的 pre-wrap 占位）。 */
export function TextBlock({ children }: { children: string }) {
  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed mb-2 text-main">
      {children}
    </div>
  )
}

/** 错误块。 */
export function ErrorBlock({ children }: { children: string }) {
  return (
    <div className="whitespace-pre-wrap break-words text-sm mb-2 text-yellow-600 dark:text-yellow-400">
      {children}
    </div>
  )
}
