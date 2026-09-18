/**
 * provider 预设（多模态归一化）：DeepSeek / GLM（智谱）/ 豆包（火山 Ark）
 * 三家的模型工厂 + 能力矩阵。三家均为 peer 可选依赖，按需安装。
 *
 * 三家差异速记（2026-09 生态调研 + 上游项目实践）：
 * - DeepSeek：官方 @ai-sdk/deepseek；图片输入仅 vision 实验模型
 *   （deepseek-v4-flash-vision-exp），Files API 优先、base64 兜底（anidea 已验证）；
 * - GLM：官方 @ai-sdk/zai；视觉模型支持图片 + 视频 URL，thinking 方言完整；
 * - 豆包：无国内 Ark 官方 SDK provider，走 @ai-sdk/openai-compatible
 *   （practi 验证：Ark 兼容端点 + includeUsage）；thinking / 会话缓存等
 *   方言经 providerOptions 透传。
 */

import { createDeepSeek } from '@ai-sdk/deepseek'
import { createZai } from '@ai-sdk/zai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'

/** 模型多模态能力描述（宿主据此做输入门控与降级提示）。 */
export interface ModelCapabilityInfo {
  /** 支持图片输入（vision）。 */
  image: boolean
  /** 建议的视觉模型 id（image 为 true 时）。 */
  visionModel?: string
}

export const DEEPSEEK_CAPABILITIES: ModelCapabilityInfo = {
  image: true,
  visionModel: 'deepseek-v4-flash-vision-exp',
}

export const ZAI_CAPABILITIES: ModelCapabilityInfo = {
  image: true,
  visionModel: 'glm-4.5v',
}

export const DOUBAO_CAPABILITIES: ModelCapabilityInfo = {
  image: true,
}

/** DeepSeek（官方 provider；模型 id 缺省给 vision 实验模型）。 */
export function createDeepSeekModel({ apiKey, model }: { apiKey: string; model?: string }): LanguageModel {
  const deepseek = createDeepSeek({ apiKey })
  return deepseek(model ?? DEEPSEEK_CAPABILITIES.visionModel!)
}

/** GLM / 智谱（官方 provider；模型 id 缺省给视觉模型）。 */
export function createZaiModel({ apiKey, model }: { apiKey: string; model?: string }): LanguageModel {
  const zai = createZai({ apiKey })
  return zai(model ?? ZAI_CAPABILITIES.visionModel!)
}

/** 豆包 / 火山 Ark（openai-compatible 通道；practi 验证的接法）。 */
export function createDoubaoModel({ apiKey, model, baseURL }: {
  apiKey: string
  model: string
  /** 缺省为国内 Ark v3 兼容端点。 */
  baseURL?: string
}): LanguageModel {
  const ark = createOpenAICompatible({
    name: 'doubao-ark',
    baseURL: baseURL ?? 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey,
    includeUsage: true,
  })
  return ark(model)
}

/** 任意 OpenAI 兼容端点（Ollama / Kimi / Qwen 等本地或第三方）。 */
export function createOpenAICompatibleModel({ name, baseURL, apiKey, model }: {
  name: string
  baseURL: string
  apiKey: string
  model: string
}): LanguageModel {
  const provider = createOpenAICompatible({ name, baseURL, apiKey })
  return provider(model)
}
