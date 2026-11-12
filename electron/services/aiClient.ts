/*
 * @Author: zhengrenfu
 * @Date: 2026-11-08 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-12 09:08:04
 * @FilePath: \electron\services\aiClient.ts
 * @Description: OpenAI 兼容 AI 客户端：读取连接配置、构造请求、归一化响应，供 IPC 与其他主进程场景复用
 */

import { AI_SETTING_KEYS } from '@/types/ai'
import type {
  AiChatMessage,
  AiChatParams,
  AiChatResult,
  AiChatTool,
  AiChatToolCall,
  AiTokenUsage,
} from '@/types/ai'
import type { AppSettings } from '@electron/services/settingsService'

// #region 常量

// 错误响应截断，避免大段错误内容进日志
export const MAX_ERROR_BODY_CHARS = 200

// 保证结论稳定可复现
export const CHAT_TEMPERATURE = 0

// 未配置超时时的默认秒数
export const DEFAULT_TIMEOUT_SECONDS = 300

// #endregion

// #region 类型定义

// 一次请求所需的连接配置
export interface AiConnectionConfig {
  // 已去掉末尾斜杠的接口根地址
  baseUrl: string
  apiKey: string
  model: string
  timeoutSec: number
}

// 构造好的 HTTP 请求
export interface AiChatRequest {
  endpoint: string
  headers: Record<string, string>
  body: Record<string, unknown>
}

// #endregion

// #region 工具函数

// 提取响应里的 token 用量，字段缺失时按 0 计，上游未返回用量时返回 undefined
export function toTokenUsage(raw: any): AiTokenUsage | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const toCount = (v: unknown): number => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  }
  const usage = {
    promptTokens: toCount(raw.prompt_tokens),
    completionTokens: toCount(raw.completion_tokens),
    totalTokens: toCount(raw.total_tokens),
  }
  return usage.promptTokens || usage.completionTokens || usage.totalTokens ? usage : undefined
}

// 判断是否为请求超时（AbortSignal.timeout 抛 TimeoutError）
export function isTimeoutError(e: unknown): boolean {
  const err = e as { name?: unknown; message?: unknown } | null | undefined
  return err?.name === 'TimeoutError' || /aborted due to timeout/i.test(String(err?.message || ''))
}

// 兼容单提示词调用：没有 messages 时把 prompt 包装成一条 user 消息
export function toMessages(params: AiChatParams): AiChatMessage[] {
  if (Array.isArray(params?.messages) && params.messages.length) return params.messages
  const prompt = String(params?.prompt ?? '')
  return prompt.trim() ? [{ role: 'user', content: prompt }] : []
}

// 过滤工具定义，缺少名称的项直接丢掉，避免接口报参数错误
export function toTools(raw: any): AiChatTool[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const tools = raw
    .filter((tool: any) => tool?.type === 'function' && tool.function?.name)
    .map((tool: any) => ({ type: 'function' as const, function: { ...tool.function } }))
  return tools.length ? tools : undefined
}

// 提取模型返回的工具调用，字段缺失的项跳过
export function toToolCalls(raw: any): AiChatToolCall[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const calls = raw
    .map((call: any) => ({
      id: String(call?.id ?? ''),
      type: 'function' as const,
      function: {
        name: String(call?.function?.name ?? ''),
        // 规范要求是 JSON 字符串，个别接口返回对象时统一序列化
        arguments:
          typeof call?.function?.arguments === 'string'
            ? call.function.arguments
            : JSON.stringify(call?.function?.arguments ?? {}),
      },
    }))
    .filter((call: AiChatToolCall) => call.id && call.function.name)
  return calls.length ? calls : undefined
}

// #endregion

// #region 配置与请求

/**
 * 读取并校验 AI 连接配置，连接配置统一来自全局设置
 * @param {AppSettings} settings 当前设置实例
 * @returns {AiConnectionConfig} 校验后的连接配置
 */
export function loadAiConfig(settings: AppSettings): AiConnectionConfig {
  const enabled = settings.get(AI_SETTING_KEYS.enabled, false)
  if (!enabled) throw new Error('AI 未启用，请在设置中开启')
  const baseUrl = String(settings.get(AI_SETTING_KEYS.baseUrl, '')).trim()
  const apiKey = String(settings.get(AI_SETTING_KEYS.apiKey, '')).trim()
  const model = String(settings.get(AI_SETTING_KEYS.model, '')).trim()
  const timeoutSec = Number(settings.get(AI_SETTING_KEYS.timeoutSeconds, DEFAULT_TIMEOUT_SECONDS)) || DEFAULT_TIMEOUT_SECONDS

  if (!baseUrl) throw new Error('未配置 AI 接口地址')
  if (!apiKey) throw new Error('未配置 API 密钥')
  if (!model) throw new Error('未配置模型名称')

  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, model, timeoutSec }
}

/**
 * 构造 OpenAI 兼容的 chat completions 请求
 * @param {AiConnectionConfig} config 连接配置
 * @param {AiChatMessage[]} messages 已归一化的消息列表
 * @param {AiChatParams} params 原始调用参数，用于读取工具定义
 * @returns {AiChatRequest} 请求地址、头与体
 */
export function buildChatRequest(
  config: AiConnectionConfig,
  messages: AiChatMessage[],
  params: AiChatParams,
): AiChatRequest {
  const tools = toTools(params?.tools)
  return {
    endpoint: `${config.baseUrl}/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: {
      model: config.model,
      temperature: CHAT_TEMPERATURE,
      messages,
      ...(tools ? { tools } : {}),
    },
  }
}

/**
 * 请求一次 chat completions 并把响应归一化为统一结构
 * @param {AiConnectionConfig} config 连接配置
 * @param {AiChatMessage[]} messages 已归一化的消息列表
 * @param {AiChatParams} params 原始调用参数，用于读取工具定义
 * @returns {Promise<AiChatResult>} 模型输出文本、思考过程、工具调用与 token 用量
 */
export async function requestChatCompletion(
  config: AiConnectionConfig,
  messages: AiChatMessage[],
  params: AiChatParams,
): Promise<AiChatResult> {
  const { endpoint, headers, body } = buildChatRequest(config, messages, params)
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.timeoutSec * 1000),
    })
    if (!res.ok) {
      const errorBody = await res.text().catch(() => '')
      throw new Error(
        `AI 接口返回 HTTP ${res.status}${errorBody ? `: ${errorBody.slice(0, MAX_ERROR_BODY_CHARS)}` : ''}`,
      )
    }
    const data: any = await res.json()
    const message = data?.choices?.[0]?.message
    const text = message?.content ? String(message.content).trim() : ''
    const toolCalls = toToolCalls(message?.tool_calls)
    // 纯工具调用时 content 为空，只有既没文本也没工具调用才算失败
    if (!text && !toolCalls) throw new Error('AI 未返回内容')
    // 推理模型单独返回思考过程，非推理模型为空
    const reasoning = message?.reasoning_content ? String(message.reasoning_content).trim() : ''
    return { text, reasoning, toolCalls, usage: toTokenUsage(data?.usage) }
  } catch (e) {
    // 原始 TimeoutError 没有可操作信息，改成用户能照做的提示
    if (isTimeoutError(e)) {
      throw new Error(`AI 接口请求超时（${config.timeoutSec} 秒），可在设置里调大 AI 请求超时后重试`)
    }
    throw e
  }
}

// #endregion
