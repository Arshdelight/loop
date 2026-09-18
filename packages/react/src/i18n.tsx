import { createContext, useContext, type ReactNode } from 'react'
import {
  resolveLabel,
  type LoopDict,
  type LoopLabelParams,
  type LoopLabelValue,
  type LoopTKey,
} from './i18nCore'

/**
 * 文案注入的 React 薄壳（协议核心见 i18nCore.ts）。渲染层零 i18n 库依赖：
 * Provider 只接受一个 Partial 字典；语言切换 = 换 dict 传值，全树重渲。
 */
const LoopI18nContext = createContext<Partial<Record<string, LoopLabelValue>>>({})

export function LoopI18nProvider({ dict, children }: {
  dict?: LoopDict
  children: ReactNode
}) {
  return (
    <LoopI18nContext.Provider value={dict ?? {}}>
      {children}
    </LoopI18nContext.Provider>
  )
}

/** 取 t 函数：`t('tool.group', { count: 3 })`。key 类型化，拼错编译期报错。 */
export function useLoopT(): (key: LoopTKey, params?: LoopLabelParams) => string {
  const dict = useContext(LoopI18nContext)
  return (key, params) => resolveLabel(dict, key, params)
}
