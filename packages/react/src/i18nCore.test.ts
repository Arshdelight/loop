import { describe, expect, it } from 'vitest'
import { enDict, resolveLabel, type LoopLabelParams } from './i18nCore'

describe('resolveLabel', () => {
  it('无覆盖时取内置英文 fallback（静态串与模板函数）', () => {
    expect(resolveLabel(undefined, 'reasoning.thought')).toBe('Thinking')
    expect(resolveLabel({}, 'tool.group', { count: 3 })).toBe('3 tool calls')
    expect(resolveLabel({}, 'tool.group', { count: 1 })).toBe('1 tool call')
  })

  it('覆盖字典优先，且只需包含差异 key', () => {
    const zh = { 'reasoning.thought': '思考' }
    expect(resolveLabel(zh, 'reasoning.thought')).toBe('思考')
    expect(resolveLabel(zh, 'tool.awaitingApproval')).toBe('awaiting approval')
  })

  it('函数值覆盖可带中文插值/无复数', () => {
    const zh = { 'tool.group': (p: LoopLabelParams) => `${p.count} 个工具调用` }
    expect(resolveLabel(zh, 'tool.group', { count: 5 })).toBe('5 个工具调用')
  })

  it('模板函数缺 params 时按空对象调用', () => {
    expect(resolveLabel({}, 'tool.group')).toBe('undefined tool calls')
  })

  it('未知 key 返回 key 本身（漏翻译在界面上可见）', () => {
    expect(resolveLabel(undefined, 'nope.missing')).toBe('nope.missing')
  })
})

describe('enDict', () => {
  it('key 分层命名且满足字典类型', () => {
    expect(Object.keys(enDict).length).toBeGreaterThanOrEqual(3)
    expect(enDict['tool.awaitingApproval']).toBeTypeOf('string')
  })
})
