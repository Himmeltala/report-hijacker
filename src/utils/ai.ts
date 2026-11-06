/*
 * @Author: zhengrenfu
 * @Date: 2026-11-03 22:25:54
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-06 12:04:00
 * @FilePath: \src\utils\ai.ts
 * @Description: AI 模块层工具：提示词占位符替换、富文本转纯文本（保留图片占位）与通用 AI 通道入口
 */

import type { AiChatParams, AiChatResult } from '@/types/ipc'

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
 *
 * 图片统一保留为 [图片] 占位，避免审查时把流程图、成果物截图当成缺失项
 * @param {string} raw 原文（可能含 HTML 或 Markdown）
 * @returns {string} 纯文本
 */
export function toPlainText(raw: string): string {
  return raw
    .replace(/<mention\b[^>]*data-text="([^"]*)"[^>]*>/gi, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<img\b[^>]*>/gi, (tag: string) => {
      const alt = /\balt="([^"]*)"/i.exec(tag)?.[1]
      return alt ? `[图片:${alt}]` : '[图片]'
    })
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_m, alt: string) => (alt ? `[图片:${alt}]` : '[图片]'))
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/^[\s|]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// #endregion

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
  const val = await window.electron.getSetting(key)
  return val === undefined || val === null ? '' : String(val)
}

// #endregion
