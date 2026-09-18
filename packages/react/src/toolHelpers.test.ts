import { describe, expect, it } from 'vitest'
import { toolNameLabel, registerToolLabel, unregisterToolLabel } from './toolHelpers'
import { mergeLoopDict, resolveLabel, type LoopTFunction, type LoopTKey, type LoopLabelParams } from './i18nCore'

/** 用真实协议构造中文 t（宽签名 cast 到 LoopTFunction）。 */
const tZh = ((key: LoopTKey, params?: LoopLabelParams) =>
  resolveLabel(mergeLoopDict('zh', undefined), key, params)) as LoopTFunction

describe('toolNameLabel · i18n', () => {
  it('传 t 时默认标题表走字典（中文）', () => {
    expect(toolNameLabel('read', tZh)).toBe('读取文件')
    expect(toolNameLabel('bash', tZh)).toBe('终端')
    expect(toolNameLabel('ask_questions', tZh)).toBe('向你提问')
  })

  it('不传 t 时英文兜底不变', () => {
    expect(toolNameLabel('read')).toBe('Reading file')
    expect(toolNameLabel('ask_questions')).toBe('Asking you')
  })

  it('字典未收录的工具名回退工具名本身', () => {
    expect(toolNameLabel('whatever_new_tool', tZh)).toBe('whatever_new_tool')
  })

  it('MCP 拆分不受 t 影响（server · tool 是名称拼接）', () => {
    expect(toolNameLabel('mcp__github__search_issues', tZh)).toBe('github · search_issues')
  })

  it('registerToolLabel 静态覆盖优先于 t，unregister 后恢复', () => {
    registerToolLabel('read', '静态标题')
    expect(toolNameLabel('read', tZh)).toBe('静态标题')
    unregisterToolLabel('read')
    expect(toolNameLabel('read', tZh)).toBe('读取文件')
  })
})
