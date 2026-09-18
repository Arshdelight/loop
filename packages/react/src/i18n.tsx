import { createContext, useContext, type ReactNode } from 'react'
import {
  mergeLoopDict,
  resolveLabel,
  type LoopDict,
  type LoopLabelParams,
  type LoopLabelValue,
  type LoopLang,
  type LoopTKey,
} from './i18nCore'

/**
 * 文案注入的 React 薄壳（协议核心见 i18nCore.ts）。渲染层零 i18n 库依赖。
 * 语言切换 = 换 lang / dict 传值，全树重渲。
 *
 * 用法（三选一或组合）：
 * - `<LoopI18nProvider lang="zh">` —— 直接用内置中文字典；
 * - `<LoopI18nProvider dict={myDict}>` —— 传覆盖字典（Partial，可只给差异 key）；
 * - `<LoopI18nProvider lang="zh" dict={{ 'tool.group': p => `${p.count} 项` }}>`
 *   —— lang 切整语言 + dict 个别微调（dict 优先）。
 */
const LoopI18nContext = createContext<Partial<Record<string, LoopLabelValue>>>({})

export function LoopI18nProvider({ lang, dict, children }: {
  lang?: LoopLang
  dict?: LoopDict
  children: ReactNode
}) {
  return (
    <LoopI18nContext.Provider value={mergeLoopDict(lang, dict)}>
      {children}
    </LoopI18nContext.Provider>
  )
}

/** 取 t 函数：`t('tool.group', { count: 3 })`。key 类型化，拼错编译期报错。 */
export function useLoopT(): (key: LoopTKey, params?: LoopLabelParams) => string {
  const dict = useContext(LoopI18nContext)
  return (key, params) => resolveLabel(dict, key, params)
}
