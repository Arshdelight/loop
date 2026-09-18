/**
 * loop 渲染层的 i18n 协议核心（纯函数、零 React、零 i18n 库依赖）。
 *
 * 设计（2026-09-18 定调）：
 * - 内置英文 fallback 字典 enDict 是 key 的唯一事实源，key 类型由此派生，
 *   拼错编译期报错；
 * - 字典值允许 `string | (params) => string`——插值与英文复数等逻辑住在
 *   字典值里，loop 不引入任何插值库；
 * - 下游用 LoopI18nProvider 传 Partial 字典覆盖（中文包可只给差异 key），
 *   有自己 i18n 体系（react-i18next / next-intl）的宿主可以现场从自己的
 *   t 生成转发字典，Provider 即适配器；
 * - 下游自定义渲染器的文案 key 通过 declaration merging 扩展
 *   LoopCustomKeys（见 README i18n 节），避免 practi「每个渲染器自己
 *   决定文案来源、大多硬编码英文」的半国际化现状复现。
 */

/** 标签字典值：静态串，或带参数的模板函数。 */
export type LoopLabelValue = string | ((params: LoopLabelParams) => string)

export interface LoopLabelParams {
  [key: string]: string | number
}

/** 内置英文 fallback 字典。tool.label.* 是工具行默认标题表
 *  （toolNameLabel 查询用，与 toolHelpers 的 BUILTIN_LABELS 一一对应）。 */
export const enDict = {
  'reasoning.thought': 'Thinking',
  'tool.group': (p) => `${p.count} tool call${p.count === 1 ? '' : 's'}`,
  'tool.awaitingApproval': 'awaiting approval',
  'tool.label.read': 'Reading file',
  'tool.label.glob': 'Finding files',
  'tool.label.grep': 'Searching contents',
  'tool.label.write': 'Writing file',
  'tool.label.edit': 'Editing file',
  'tool.label.bash': 'Terminal',
  'tool.label.web_search': 'Searching web',
  'tool.label.webpage_view': 'Reading page',
  'tool.label.ask_questions': 'Asking you',
  'tool.label.add_to_workspace': 'Adding to workspace',
  'tool.label.skill': 'Loading skill',
  'tool.label.hippo': 'Digesting conversation',
  'tool.label.research': 'Researching',
  'tool.label.general': 'Running sub-task',
  'code.copy': 'Copy code',
  'code.showDiagram': 'Show diagram',
  'code.viewSource': 'View source',
} as const satisfies Record<string, LoopLabelValue>

export type BuiltinLoopTKey = keyof typeof enDict

/** 内置中文字典（与 enDict 同 key；新增 key 时两份同步维护）。 */
export const zhDict: Record<BuiltinLoopTKey, LoopLabelValue> = {
  'reasoning.thought': '思考',
  'tool.group': (p) => `${p.count} 个工具调用`,
  'tool.awaitingApproval': '等待确认',
  'tool.label.read': '读取文件',
  'tool.label.glob': '查找文件',
  'tool.label.grep': '搜索内容',
  'tool.label.write': '写入文件',
  'tool.label.edit': '编辑文件',
  'tool.label.bash': '终端',
  'tool.label.web_search': '搜索网页',
  'tool.label.webpage_view': '阅读网页',
  'tool.label.ask_questions': '向你提问',
  'tool.label.add_to_workspace': '添加到工作区',
  'tool.label.skill': '加载技能',
  'tool.label.hippo': '整理对话',
  'tool.label.research': '调研中',
  'tool.label.general': '运行子任务',
  'code.copy': '复制代码',
  'code.showDiagram': '查看图表',
  'code.viewSource': '查看源码',
}

/** 包直接支持的语言（新语言 = 往这里加一份字典）。 */
export const loopDicts = { en: enDict, zh: zhDict } as const
export type LoopLang = keyof typeof loopDicts

/** 下游可 declaration merging 增补的自定义 key（默认为空）。 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LoopCustomKeys {}

export type LoopTKey = BuiltinLoopTKey | keyof LoopCustomKeys

/** useLoopT 返回的 t 函数类型。 */
export type LoopTFunction = (key: LoopTKey, params?: LoopLabelParams) => string

/** 下游可传入的覆盖字典：只需包含想覆盖的 key。 */
export type LoopDict = Partial<Record<LoopTKey, LoopLabelValue>>

/**
 * Provider 的字典合并（纯函数）：显式 dict 优先 > lang 内置字典 >
 * enDict fallback（resolveLabel 内置）。lang 与 dict 可同时用——
 * lang 切整语言，dict 做个别微调。
 */
export function mergeLoopDict(
  lang: LoopLang | undefined,
  dict: LoopDict | undefined,
): Partial<Record<string, LoopLabelValue>> {
  return { ...(lang !== undefined ? loopDicts[lang] : {}), ...dict }
}

/**
 * 解析一条文案：覆盖字典优先，其次内置英文，未知 key 返回 key 本身
 * （让漏翻译在界面上直接可见，而不是静默空白）。
 */
export function resolveLabel(
  overrides: Partial<Record<string, LoopLabelValue>> | undefined,
  key: string,
  params?: LoopLabelParams,
): string {
  const value = overrides?.[key] ?? enDict[key as BuiltinLoopTKey]
  if (value === undefined) return key
  return typeof value === 'function' ? value(params ?? {}) : value
}
