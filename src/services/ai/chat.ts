/*
 * @Author: zhengrenfu
 * @Date: 2026-11-08 16:12:36
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-08 18:40:00
 * @FilePath: \src\services\ai\chat.ts
 * @Description: 渲染层 AI 通道封装：统一调用主进程通道并读取 AI 配置项
 */

import type { AiChatParams, AiChatResult } from '@/types/ai'
import type { AiUsageRange, AiUsageSummary } from '@/types/aiUsage'

// #region 通用通道

/**
 * 调用统一 AI 通道
 * @param {AiChatParams} params 单轮提示词或完整消息列表，可附带工具定义
 * @returns {Promise<AiChatResult & { reasoning: string }>} 模型输出文本、思考过程与本轮工具调用，思考过程统一转为字符串
 */
export async function aiChat(params: AiChatParams): Promise<AiChatResult & { reasoning: string }> {
  const ret = await window.electron.aiChat(params)
  return { text: ret.text, reasoning: ret.reasoning ?? '', toolCalls: ret.toolCalls }
}

/**
 * 读取某模块的 AI 配置项（提示词等按模块独立配置，键名带模块前缀）
 * @param {string} key 完整设置键，如 ai.taskReview.prompt
 * @returns {Promise<string>} 设置值，未配置返回空字符串
 */
export async function getAiSetting(key: string): Promise<string> {
  const val = await window.electron.getSetting<unknown>(key)
  return val === undefined || val === null ? '' : String(val)
}

/**
 * 查询 AI token 用量汇总
 * @param {AiUsageRange} range 统计范围，单位为天，0 表示全部
 * @returns {Promise<AiUsageSummary>} 用量汇总结果
 */
export async function getAiUsageSummary(range: AiUsageRange): Promise<AiUsageSummary> {
  return window.electron.aiUsageSummary(range)
}

// #endregion
