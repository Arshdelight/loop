// In-memory shared expanded-state for reasoning blocks. A reasoning block
// starts streaming inside a live view and, once the turn completes, may be
// re-rendered from a persisted store — two different components at different
// times. Local useState can't survive that transition, so the expanded flag
// lives here, keyed per block (conversationId + block index). Memory-only on
// purpose: a stale flag across app restarts has no value.
const expandedByKey = new Map<string, boolean>()

export function getReasoningExpanded(key: string): boolean {
  return expandedByKey.get(key) ?? false
}

export function setReasoningExpanded(key: string, expanded: boolean): void {
  expandedByKey.set(key, expanded)
}
