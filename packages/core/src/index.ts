// @loop/core — agent 编排内核（骨架占位，模块规划见仓库 README）
//
// 规划模块（来源：practi / anidea / okoknit 三项目调研结论）：
// - provider 预设与多模态归一化（DeepSeek / GLM / 豆包，图片注入、能力矩阵）
// - agent 装配（基于 Vercel AI SDK ToolLoopAgent 的封装 + 事件协议）
// - 工具定义与注册表（zod / JSON Schema 双轨）
// - human-in-the-loop 挂起桥（anidea planbus/askbus 模式泛化）
// - 流事件归并 reducer（okoknit pushEvent 提纯）
export const LOOP_CORE_VERSION = "0.0.1";
