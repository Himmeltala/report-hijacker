/*
 * @Author: zhengrenfu
 * @Date: 2026-11-03 22:25:54
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-03 22:25:54
 * @FilePath: \src\utils\ai.ts
 * @Description: AI 模块层工具：提示词占位符替换、纯文本转换与通用 AI 通道入口
 */

import type { AiChatParams } from '@/types/ipc'

// #region 常量

// 上下文片段送入提示词的最大字符数，控制 token 体积
export const MAX_CONTEXT_CHARS = 4000

// #endregion

// #region 提示词工具

/**
 * 将提示词模板中的占位符替换为上下文值
 * @param {string} template 提示词模板，占位符如 {title}
 * @param {Record<string, string>} ctx 占位符值
 * @returns {string} 替换后的完整提示词
 */
export function fillPrompt(template: string, ctx: Record<string, string>): string {
  let out = template
  for (const [key, val] of Object.entries(ctx)) {
    out = out.split(`{${key}}`).join(val || '(空)')
  }
  return out
}

/**
 * 去除 HTML 标签并还原常见实体，将富文本转为纯文本
 * @param {string} raw 原文（可能含 HTML）
 * @returns {string} 纯文本
 */
export function toPlainText(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

// #endregion

// #region 通用通道

/**
 * 调用统一 AI 通道
 * @param {string} prompt 已组装完成的完整提示词
 * @returns {Promise<string>} 模型返回文本
 */
export async function aiChat(prompt: string): Promise<string> {
  const params: AiChatParams = { prompt }
  const ret = await window.electron.aiChat(params)
  return ret.text
}

/**
 * 读取某模块的 AI 配置项（提示词等按模块独立配置，键名带模块前缀）
 * @param {string} key 完整设置键，如 ai.taskReview.prompt
 * @returns {Promise<string>} 设置值，未配置返回空字符串
 */
export async function getAiSetting(key: string): Promise<string> {
  const val = await window.electron.getSetting(key)
  return val === undefined || val === null ? '' : String(val)
}

// #endregion
