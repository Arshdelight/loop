import {
  Search, FileText, SquareTerminal, FilePlus, FileDiff, Globe, Sparkles,
  Brain, SquareLibrary, Bot, Plug, Wrench, ListTodo, Plus,
  type LucideIcon,
} from 'lucide-react'
import { classifyToolVariant, type ToolVariant } from './toolCallModel'

const VARIANT_ICONS: Record<ToolVariant, LucideIcon> = {
  search: Search,
  read: FileText,
  bash: SquareTerminal,
  write: FilePlus,
  edit: FileDiff,
  web: Globe,
  skill: Sparkles,
  memory: Brain,
  practice: SquareLibrary,
  agent: Bot,
  mcp: Plug,
  todo: ListTodo,
  workspace: Plus,
  other: Wrench,
}

/** Inline variant icon for a tool name — resolves classification + icon in one
 *  component so callers never hold a component-typed local during render. */
export function ToolIcon({ name, className }: { name: string; className?: string }) {
  const Icon = VARIANT_ICONS[classifyToolVariant(name)]
  return <Icon className={className} />
}
