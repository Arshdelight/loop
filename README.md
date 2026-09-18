# loop

从 [practi](D:\dev\practi) / [anidea](D:\dev\anidea) / [okoknit](D:\order\okoknit) 三个项目抽提的 **AI agent 编排 + 工具渲染** 共享 npm 包。

- **`@loop/core`**：编排内核 —— agent 装配（Vercel AI SDK v7）、事件协议、多模态归一化（DeepSeek / GLM / 豆包）、provider 预设、human-in-the-loop 挂起桥、流归并 reducer。零 React 依赖，Node / Edge / 主进程可用。
- **`@loop/react`**：渲染层 —— ToolRow 工具行、工具渲染器注册表（下游可注册新工具的专属渲染器）、markdown 渲染器、ReasoningBlock。

状态：**调研完成，架构讨论中**（见 AGENTS.md 与仓库根的调研结论）。包名为占位，发布前需定 npm scope。

## 开发

```bash
pnpm install
pnpm typecheck
```

## 架构调研摘要

三个上游项目的公共模式（已验证三轮重复）：

| 模式 | practi | anidea | okoknit |
|---|---|---|---|
| AI SDK | v7（仅传输层，自研 loop） | v7（ToolLoopAgent） | v7（ToolLoopAgent） |
| 工具 schema | 手写 JSON Schema | zod v4 | 手写 JSON Schema |
| 多模态图片注入 | content parts 展开 | prepareStep + Files API | prepareStep + pendingImages |
| ToolRow | React 原版 | vanilla 移植 | React 简化版 |
| markdown | react-markdown 全家桶 | marked（无高亮） | 无 |
| 流式传输 | Electron IPC 广播 | NDJSON over HTTP | Electron IPC |

生态结论：底座选 Vercel AI SDK v7（2026 主流正确选择）；LangGraph 概念吸收（可恢复中断、thread 持久化）不整包引入；工具渲染注册 API 参考 assistant-ui 的 `defineToolkit`（注册表 + 状态机 props + Fallback 兜底）。
