/**
 * UserBridge —— HITL 挂起桥（单槽，2026-09-18 机制决策 B 的引擎侧）。
 *
 * anidea planbus/askbus 模式的最小泛化：ask_questions 类工具的 execute 里
 * await agent.waitForUser() 挂起当前循环；宿主 UI 用 findPendingTool 找到
 * 挂起中的工具条目、收集回答后调用 agent.resolveUser(output)，execute 返回，
 * AI SDK 把返回值作为工具结果回流模型。
 *
 * 单槽假设与 practi 后端一致（按会话阻塞，同时只有一个 ask 类工具挂起）。
 */

export interface UserBridge<T = unknown> {
  /** 工具 execute 内调用：挂起等待用户输入（同一时刻只支持一个等待者）。 */
  waitForUser(): Promise<T>
  /** 宿主提交答案；返回是否成功唤醒（无等待者时 false）。 */
  resolveUser(value: T): boolean
  /** 放弃等待（如会话中断），等待者收到 undefined。 */
  abandonUser(): void
  /** 当前是否有挂起中的等待（UI 守卫用）。 */
  readonly pending: boolean
}

export function createUserBridge<T = unknown>(): UserBridge<T> {
  let resolver: ((value: T | undefined) => void) | undefined

  return {
    waitForUser() {
      return new Promise<T>(resolve => {
        resolver = resolve as (value: T | undefined) => void
      })
    },
    resolveUser(value) {
      if (resolver === undefined) return false
      const r = resolver
      resolver = undefined
      r(value)
      return true
    },
    abandonUser() {
      if (resolver === undefined) return
      const r = resolver
      resolver = undefined
      r(undefined)
    },
    get pending() { return resolver !== undefined },
  }
}
