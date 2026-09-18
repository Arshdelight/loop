# lucide 图标推荐

> 下游给自定义工具选图标时的一致性参考。映射事实来自 practi 的
> `toolRenderers/toolRow/toolIcon.tsx`（dsh 血统，三轮项目验证），辅助图标
> 来自 practi 各渲染器的实际使用。loop-react 的变体映射与其一脉相承。

## 设计原则

1. **图标表行为，不表身份**：优先选能区分「这个工具在做什么」的符号——
   grep 是放大镜（Search）、edit 是差异（FileDiff）、write 是新增文件（FilePlus）。
   只在行为难以图形化时才表对象（memory → Brain）。
2. **变体优先于专属**：新工具先看会不会被 `classifyToolVariant` 归进已有变体
   （read/glob/grep/write/edit/bash/web/agent/mcp…），同类共享图标保持整列语义连贯；
   确有需要再用 `icon` prop 传专属图标（practi 仅 ask_questions →
   MessageCircleQuestion、explore 组 → FileScan 两处专属覆盖）。
3. **尺寸与位置纪律**：行内图标一律 `size-4`（16px），行壳的图标槽在 hover 时
   淡出换 ChevronRight——所以专属图标必须与 chevron 同尺寸同位，不要自带 margin。
4. **线性描边，禁混搭**：只用 lucide 线性图标；不要混入填充风格图标、emoji
   或其他图标库（视觉重量突变会破坏整列节奏）。
5. **颜色纪律**：图标默认继承 `text-muted`；唯一的品牌色警示是错误态的
   `AlertCircle`（琥珀）。自定义图标不要自带颜色，让主题 token 决定。
6. **运行态不靠图标表达**：运行中由行壳的扫光 + 标题高亮表达，图标不变——
   不要给「运行/完成」配不同图标。

## 变体 → 图标官方映射

`@arshdelight/loop-react` 内置（`ToolIcon` 组件按 `classifyToolVariant` 分发）：

| 变体 | 图标 | 语义 | 归类来源 |
|---|---|---|---|
| search | `Search` | 搜索：glob / grep / 含 search·find·query·list 词的 MCP | 精确名 + MCP 启发式 |
| read | `FileText` | 读取：read / 含 read·get·fetch·view 的 MCP | 精确名 + MCP 启发式 |
| bash | `SquareTerminal` | 终端执行：bash / 含 shell·exec·run·command | 精确名 + MCP 启发式 |
| write | `FilePlus` | 写入/新建：write / 含 create·update·delete·push·post | 精确名 + MCP 启发式 |
| edit | `FileDiff` | 编辑（差异） | 精确名 |
| web | `Globe` | 网络访问：web_search / webpage_view | 精确名 |
| skill | `Sparkles` | 技能加载 | 精确名 |
| memory | `Brain` | 记忆类（`memory_` 前缀） | 前缀 |
| practice | `SquareLibrary` | practi 实践类（`practice_` 前缀） | 前缀 |
| agent | `Bot` | 子代理（hippo / research / general） | 名单 |
| mcp | `Plug` | 未识别为以上任何类别的 MCP 工具 | 兜底 |
| todo | `ListTodo` | 任务清单 | 精确名 |
| workspace | `Plus` | 添加到工作区（呼应输入框的 + 按钮） | 精确名 |
| other | `Wrench` | 未注册工具的通用兜底 | 兜底 |

专属覆盖的用法（渲染器内）：

```tsx
import { MessageCircleQuestion } from 'lucide-react'
<ToolRow toolName="ask_questions" icon={MessageCircleQuestion} ... />
```

## 按场景的扩展推荐

下游新工具如果在官方变体之外，按动作场景从下表选（均为 lucide 稳定名）：

| 场景 | 首选 | 备选 |
|---|---|---|
| 查看 / 预览 | `Eye` | `Scan`、`BookOpen` |
| 上传 / 导入 | `FileUp` | `Upload` |
| 下载 / 导出 | `Download` | — |
| 复制 / 克隆 | `Copy` | — |
| 删除 | `Trash2` | — |
| 重试 / 刷新 | `RefreshCw` | — |
| 图片查看 / 生成 | `Image` | `ImagePlus` |
| 表格 / 数据 | `Table` | `Database` |
| 图表绘制 | `BarChart3` | `LineChart` |
| 外链 / 跳转 | `ExternalLink` | `Link` |
| 校验 / 审核 | `ShieldCheck` | `BadgeCheck` |
| 撰写 / 创作 | `PenLine` | `Palette`、`Wand2` |
| 音频 | `AudioLines` | `Mic` |
| 视频 | `Video` | — |
| 日程 / 提醒 | `CalendarCheck` | `Clock`、`Timer` |
| 知识库 / 文档集 | `BookMarked` | `FolderOpen` |
| 对照 / 分栏 | `Split` | `Columns2` |

## UI 辅助图标约定（行壳语义槽）

这些图标在行壳 / 内置组件中承担固定语义，自定义渲染器请复用同名图标
而不是换近义词（保持整列一致性）：

| 图标 | 语义槽 | 使用处 |
|---|---|---|
| `ChevronRight` | 展开指示（hover 淡入，展开时旋转 90°） | ToolRow / ReasoningBlock |
| `AlertCircle` | 错误 / 中断警示（琥珀，行尾 + 失败图标位） | ToolRow / ask_questions |
| `Lightbulb` | 思考块 | ReasoningBlock |
| `Check` | 已选 / 完成 | 表单卡、复制按钮 |
| `Copy` | 复制到剪贴板 | 各展开体 |
| `Download` | 下载产物 | 附件 / 图片卡 |
| `X` | 关闭 / 取消 | 弹层、面板 |
| `Loader2` | 局部加载（非行级运行态） | 按钮内 spinner |

## 反例

- ❌ `base64 编码工具 → FileJson`（表对象不表行为；应落 `FileText` 或专属 `Binary`）
- ❌ 运行态换 `Loader2` 图标（行壳扫光已是运行信号，重复表达）
- ❌ 直接内联 SVG 或混用 iconify/heroicons（破坏线性描边一致性）
- ❌ 图标上 `text-red-500` 之类的硬颜色（颜色应由主题 token 与错误约定管理）
