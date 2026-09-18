/**
 * 图片回注队列（多模态归一化第一块：prepareStep 注入模式）。
 *
 * 三家上游各自踩过的同一个坑：OpenAI 兼容端点的 tool 消息只收字符串，
 * 工具产出的图片必须包装成 user 消息回注模型视野（anidea 的 Files API
 * 注入、okoknit 的 motifPrepareStep 同款）。引擎在每步前调用 drain，
 * 把队列里的图片作为紧随其后的 user 消息追加。
 */

export interface LoopImagePart {
  /** base64（不含 data: 前缀）或远程 URL，二选一。 */
  data?: string
  url?: string
  mediaType: string
}

const queue: LoopImagePart[] = []

export function enqueueImage(image: LoopImagePart): void {
  queue.push(image)
}

/** 取走全部待注入图片（prepareStep 每步调用一次）。 */
export function drainImages(): LoopImagePart[] {
  return queue.splice(0, queue.length)
}

export function hasQueuedImages(): boolean {
  return queue.length > 0
}
