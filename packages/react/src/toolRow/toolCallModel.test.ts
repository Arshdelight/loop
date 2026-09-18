import { describe, expect, it } from 'vitest'
import {
  classifyToolVariant, deriveToolSummary, firstErrorLine,
  tryParseJson, salvageStringArg,
} from './toolCallModel'

describe('classifyToolVariant', () => {
  it('精确名命中', () => {
    expect(classifyToolVariant('read')).toBe('read')
    expect(classifyToolVariant('glob')).toBe('search')
    expect(classifyToolVariant('bash')).toBe('bash')
    expect(classifyToolVariant('web_search')).toBe('web')
    expect(classifyToolVariant('ask_questions')).toBe('other')
  })

  it('前缀命中与默认兜底', () => {
    expect(classifyToolVariant('memory_save')).toBe('memory')
    expect(classifyToolVariant('practice_distill')).toBe('practice')
    expect(classifyToolVariant('whatever_new_tool')).toBe('other')
  })

  it('MCP 工具名按 server/tool 段词边界启发式分类', () => {
    expect(classifyToolVariant('mcp__github__search_issues')).toBe('search')
    expect(classifyToolVariant('mcp__fs__read_file')).toBe('read')
    expect(classifyToolVariant('mcp__db__create_record')).toBe('write')
    expect(classifyToolVariant('mcp__sys__run_command')).toBe('bash')
    expect(classifyToolVariant('mcp__weather__temperature')).toBe('mcp')
  })
})

describe('deriveToolSummary', () => {
  it('按 SUMMARY_KEYS 顺序取第一个非空', () => {
    expect(deriveToolSummary({ path: 'a.ts', query: 'x' })).toBe('a.ts')
    expect(deriveToolSummary({ query: '关键词', extra: 1 })).toBe('关键词')
  })

  it('空白折叠与超长截断', () => {
    expect(deriveToolSummary({ command: 'git  status\n' })).toBe('git status')
    const long = { command: 'x'.repeat(200) }
    const summary = deriveToolSummary(long)
    expect(summary.length).toBe(140)
    expect(summary.endsWith('…')).toBe(true)
  })

  it('非对象入参直接展示标量', () => {
    expect(deriveToolSummary('裸字符串')).toBe('裸字符串')
    expect(deriveToolSummary(42)).toBe('42')
    expect(deriveToolSummary(null)).toBe('')
  })
})

describe('firstErrorLine', () => {
  it('取首个非空行并折叠空白', () => {
    expect(firstErrorLine('Error: boom\n    at foo (bar.ts:1)')).toBe('Error: boom')
    expect(firstErrorLine('\n\n  spaced   out  ')).toBe('spaced out')
  })
})

describe('tryParseJson / salvageStringArg（流式截断容错）', () => {
  it('截断 JSON 回退原文', () => {
    expect(tryParseJson('{"path":"src/fo')).toBe('{"path":"src/fo')
    expect(tryParseJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('从截断参数中抢救字符串值并展开转义', () => {
    expect(salvageStringArg('{"path":"src/foo.t', 'path')).toBe('src/foo.t')
    expect(salvageStringArg('{"command":"npm \\"insta', 'command')).toBe('npm "insta')
    expect(salvageStringArg('{"other":1}', 'path')).toBe('')
    expect(salvageStringArg(undefined, 'path')).toBe('')
  })
})
