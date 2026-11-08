/*
 * @Author: zhengrenfu
 * @Date: 2026-11-08 16:13:02
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-08 18:40:00
 * @FilePath: \src\services\ai\toolLoop.ts
 * @Description: 通用工具调用循环：多轮请求直到模型给出结论，接口不支持工具时抛可识别错误
 */

import type { AiChatMessage, AiChatTool, AiChatToolCall } from '@/types/ai'
import { aiChat } from '@/services/ai/chat'

// #region 常量

// 单次对话允许的工具调用轮数，防止模型反复调用不收敛
export const MAX_TOOL_ROUNDS = 4

// #endregion

// #region 工具函数

/**
 * 判断是否为接口不支持工具调用的错误
 * @param {any} e 异常
 * @returns {boolean} 不支持工具调用时返回 true
 */
export function isToolsUnsupportedError(e: any): boolean {
  const text = String(e?.message || '')
  return /HTTP 4\d\d/.test(text) && /tool|function|unsupported|not support|不支持/i.test(text)
}

// #endregion

// #region 工具循环

export interface ToolLoopOptions {
  // 主提示词（已替换占位符）
  prompt: string
  // 可用工具定义
  tools: AiChatTool[]
  // 执行一次工具调用，返回回填给模型的结果
  execute: (call: AiChatToolCall) => Promise<string>
  // 追加在用户消息末尾的说明，如工具调用要求
  instruction?: string
  // 最大工具调用轮数，默认 MAX_TOOL_ROUNDS
  maxRounds?: number
  // 超限时的错误信息，默认沿用任务审查文案
  maxRoundsError?: string
}

export interface ToolLoopResult {
  // 模型最终输出
  conclusion: string
  // 各轮思考过程，按轮次拼接
  reasoning: string
}

/**
 * 反复请求模型直到不再调用工具，每轮把工具结果回填进消息
 * @param {ToolLoopOptions} options 提示词、工具定义与执行器
 * @returns {Promise<ToolLoopResult>} 最终结论与各轮思考过程
 */
export async function runToolLoop(options: ToolLoopOptions): Promise<ToolLoopResult> {
  const { prompt, tools, execute, instruction, maxRounds = MAX_TOOL_ROUNDS } = options
  const content = instruction ? `${prompt}\n\n${instruction}` : prompt
  const messages: AiChatMessage[] = [{ role: 'user', content }]
  const reasoning: string[] = []

  for (let round = 0; round < maxRounds; round++) {
    const resp = await aiChat({ messages, tools })
    if (resp.reasoning) reasoning.push(resp.reasoning)
    const calls = resp.toolCalls ?? []
    if (!calls.length) return { conclusion: resp.text, reasoning: reasoning.join('\n\n') }
    messages.push({ role: 'assistant', content: resp.text || '', tool_calls: calls })
    for (const call of calls) {
      messages.push({ role: 'tool', tool_call_id: call.id, content: await execute(call) })
    }
  }
  throw new Error(options.maxRoundsError ?? `AI 审查超过 ${maxRounds} 轮工具调用，已中止`)
}

// #endregion
