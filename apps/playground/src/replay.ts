import type { AgentEvent } from '@arshdelight/loop-core'

/**
 * fixture 回放器（参考 practi tooltest 的 token 节流流式模式）：
 * 把一段事件脚本按真实节奏推给 dispatch——文本/参数按字符切片，
 * 工具间留人间停顿。Playground 与渲染层单测共用。
 */

export type ReplayItem =
  | { event: AgentEvent; delay?: number }
  | {
      /** 按字符切片流式推送的文本。 */
      stream: string
      as: 'text-delta' | 'reasoning-delta'
      charDelay?: number
    }
  | {
      /** 按字符切片流式推送的工具参数（JSON 文本）。 */
      stream: string
      as: 'tool-call-args-delta'
      toolCallId: string
      charDelay?: number
    }
  | {
      /** 按字符切片流式推送的工具输出增量。 */
      stream: string
      as: 'tool-output-delta'
      toolCallId: string
      charDelay?: number
    }

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

export interface ReplayHandle {
  cancel: () => void
  done: Promise<void>
}

export function replayEvents(
  script: ReplayItem[],
  dispatch: (event: AgentEvent) => void,
  { startDelay = 300 }: { startDelay?: number } = {},
): ReplayHandle {
  let cancelled = false
  const done = (async () => {
    await sleep(startDelay)
    for (const item of script) {
      if (cancelled) return
      if ('event' in item) {
        dispatch(item.event)
        await sleep(item.delay ?? 350)
        continue
      }
      const { stream, charDelay = 24 } = item
      for (let i = 0; i < stream.length; i += 3) {
        if (cancelled) return
        const chunk = stream.slice(i, i + 3)
        switch (item.as) {
          case 'text-delta':
          case 'reasoning-delta':
            dispatch({ type: item.as, text: chunk })
            break
          case 'tool-call-args-delta':
            dispatch({ type: item.as, toolCallId: item.toolCallId, argsText: chunk })
            break
          case 'tool-output-delta':
            dispatch({ type: item.as, toolCallId: item.toolCallId, outputText: chunk })
            break
        }
        await sleep(charDelay)
      }
      await sleep(200)
    }
  })()
  return { cancel: () => { cancelled = true }, done }
}
