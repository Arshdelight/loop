/**
 * Pure tool-call row model — loop 的移植（源自 practi 的 tool-call-model，
 * 其自述为 dsh packages/client/ui-tool tool-call-model.ts）：变体分类、
 * 按常见参数键提取单行摘要、错误首行推导。渲染器无关、零依赖、可测；
 * 通用 Fallback 卡与各 per-tool 卡都建立在它之上。
 */

/** Visual variant used to pick icon + accent. */
export type ToolVariant =
  | 'search' | 'read' | 'bash' | 'write' | 'edit' | 'web'
  | 'skill' | 'memory' | 'practice' | 'agent' | 'mcp' | 'todo' | 'workspace' | 'other'

const VARIANT_BY_NAME: Record<string, ToolVariant> = {
  read: 'read',
  glob: 'search',
  grep: 'search',
  write: 'write',
  edit: 'edit',
  bash: 'bash',
  web_search: 'web',
  webpage_view: 'web',
  skill: 'skill',
  ask_questions: 'other',
  add_to_workspace: 'workspace',
  todo_write: 'todo',
}

const VARIANT_BY_PREFIX: Array<{ prefix: string; variant: ToolVariant }> = [
  { prefix: 'memory_', variant: 'memory' },
  { prefix: 'practice_', variant: 'practice' },
]

/** Generic-card heuristic: unregistered tool names are classified so a
 *  stranger (any MCP tool) still gets a sensible icon and summary behavior. */
export function classifyToolVariant(toolName: string): ToolVariant {
  const exact = VARIANT_BY_NAME[toolName]
  if (exact) return exact
  for (const { prefix, variant } of VARIANT_BY_PREFIX) {
    if (toolName.startsWith(prefix)) return variant
  }
  if (toolName === 'hippo' || toolName === 'research' || toolName === 'general') return 'agent'
  if (toolName.startsWith('mcp__')) {
    // Word-boundary heuristic over the server and tool segments: single
    // underscores split words, "__" separates server from tool.
    const words = toolName.slice('mcp__'.length).toLowerCase().replace(/_+/g, ' ')
    if (/\b(search|find|query|list)\b/.test(words)) return 'search'
    if (/\b(read|get|fetch|view)\b/.test(words)) return 'read'
    if (/\b(write|create|update|edit|delete|push|put|post)\b/.test(words)) return 'write'
    if (/\b(bash|shell|exec|run|terminal|command)\b/.test(words)) return 'bash'
    return 'mcp'
  }
  return 'other'
}

const SUMMARY_KEYS = [
  'command', 'path', 'file_path', 'filePath', 'pattern', 'query',
  'url', 'task', 'name', 'skill', 'content', 'text',
] as const

const SUMMARY_MAX_LENGTH = 140

function toSummaryValue(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

/**
 * One-line summary from the call's arguments: the first recognized key wins
 * (command / path / pattern / query / url / task / name …), single-spaced and
 * length-capped.
 */
export function deriveToolSummary(input: unknown): string {
  if (!input || typeof input !== 'object') {
    return toSummaryValue(input) ?? ''
  }
  const args = input as Record<string, unknown>
  for (const key of SUMMARY_KEYS) {
    if (key in args) {
      const value = toSummaryValue(args[key])
      if (value === null || value === '') continue
      const flat = value.replace(/\s+/g, ' ').trim()
      if (!flat) continue
      return flat.length > SUMMARY_MAX_LENGTH ? flat.slice(0, SUMMARY_MAX_LENGTH - 1) + '…' : flat
    }
  }
  return ''
}

/** First line of an error message, single-spaced — the collapsed row swaps
 *  its summary for this on failed calls. */
export function firstErrorLine(error: string): string {
  const line = error.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).find(Boolean) ?? ''
  return line.length > SUMMARY_MAX_LENGTH ? line.slice(0, SUMMARY_MAX_LENGTH - 1) + '…' : line
}

/** Tolerant JSON.parse for mid-stream arguments (a truncated tool-call-args
 *  JSON string falls back to the raw text). */
export function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** Best-effort string value for `key` from ACCUMULATED mid-stream args that
 *  may be truncated inside the value (`{"path":"src/foo.t`). Returns '' when
 *  the key hasn't arrived yet. Display-only — the exact parsed input replaces
 *  it at tool-call-input. Common JSON escapes are unfolded so Windows paths
 *  don't read as `src\\foo`; the capture crosses escaped quotes (`\"`) so a
 *  value like `npm "install` keeps being salvaged mid-string. */
export function salvageStringArg(args: string | undefined, key: string): string {
  if (!args) return ''
  const m = args.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`))
  const raw = m?.[1]
  if (raw === undefined) return ''
  return raw.replace(/\\(.)/g, (_, ch: string) =>
    ch === 'n' ? '\n' : ch === 't' ? '\t' : ch)
}
