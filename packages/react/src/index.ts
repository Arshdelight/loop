// @loop/react — agent 渲染层（骨架占位，模块规划见仓库 README）
//
// 规划模块（来源：practi 渲染层调研结论，anidea/okoknit 为已验证的移植目标）：
// - ToolRow 三件套（ToolRow 壳 / toolCallModel 纯函数行模型 / 图标映射）
// - 工具渲染器注册表（registerToolRenderer / registerStreamToolRenderer + 通用 Fallback 兜底）
// - Markdown 渲染器（react-markdown + 代码高亮 + mermaid + 流式光标）
// - ReasoningBlock（思考行折叠/展开）
// - Explore 分组（连续只读工具合并折叠）
export const LOOP_REACT_VERSION = "0.0.1";
