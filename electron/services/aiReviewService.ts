/*
 * @Author: zhengrenfu
 * @Date: 2026-11-03
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-03
 * @FilePath: \electron\services\aiReviewService.ts
 * @Description: AI 任务审查 IPC：取任务详情与评论区，按提示词调用大模型生成审查结论
 */

import { ipcMain } from 'electron'
import type { ApiClient } from '@electron/services/apiClient'
import type { AppSettings } from '@electron/services/settingsService'

// #region 常量

// 任务描述与评论区送入提示词的最大字符数，控制 token 体积
const MAX_DESCRIPTION_CHARS = 4000
const MAX_COMMENTS_CHARS = 4000

// 接口错误响应截取长度，避免大段错误内容进日志
const MAX_ERROR_BODY_CHARS = 200

// #endregion

// #region 工具函数

/**
 * 去除 HTML 标签并还原常见实体，将任务描述转为纯文本
 * @param {string} raw 描述原文（可能含 HTML）
 * @returns {string} 纯文本
 */
function toPlainText(raw: string): string {
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

/**
 * 从 activities 响应中提取评论区纯文本（与渲染端 extractCommentText 同口径）
 * @param {any} activities 活动列表 API 响应
 * @returns {string} 拼接后的评论区文本
 */
function extractCommentText(activities: any): string {
  const elements = activities?._embedded?.elements || []
  const comments = elements.filter((el: any) => el._type === 'Activity::Comment' && el.comment?.raw?.trim())
  return comments.map((c: any) => c.comment.raw).join('\n---\n')
}

/**
 * 将提示词模板中的占位符替换为任务上下文
 * @param {string} template 提示词模板，占位符如 {title}
 * @param {Record<string, string>} ctx 占位符值
 * @returns {string} 替换后的完整提示词
 */
function fillPrompt(template: string, ctx: Record<string, string>): string {
  let out = template
  for (const [key, val] of Object.entries(ctx)) {
    out = out.split(`{${key}}`).join(val || '(空)')
  }
  return out
}

// #endregion

// #region IPC 注册

/**
 * 注册 AI 审查 IPC
 * @param {object} api API 客户端
 * @param {object} deps 依赖项
 * @param {() => AppSettings} deps.getSettings 获取当前设置实例
 */
export function setupAiReviewIpc(api: ApiClient, deps: { getSettings: () => AppSettings }): void {
  const { getSettings } = deps

  ipcMain.handle('ai:review', async (_e, params: { taskId: string; cookie: string }) => {
    const { taskId, cookie } = params
    const s = getSettings()

    const enabled = s.get('ai.enabled', false)
    if (!enabled) throw new Error('AI 审查未启用，请在设置中开启')
    const baseUrl: string = s.get('ai.baseUrl', '')
    const apiKey: string = s.get('ai.apiKey', '')
    const model: string = s.get('ai.model', '')
    const prompt: string = s.get('ai.prompt', '')
    const timeoutSec = Number(s.get('ai.timeoutSeconds', 120)) || 120

    // 前置校验，配置缺失时给出可直接操作的提示
    if (!baseUrl.trim()) throw new Error('未配置 AI 接口地址')
    if (!apiKey.trim()) throw new Error('未配置 API 密钥')
    if (!model.trim()) throw new Error('未配置模型名称')
    if (!prompt.trim()) throw new Error('未配置审查提示词')
    if (!taskId || !cookie) throw new Error('缺少 taskId 或 cookie')

    // 1. 并发取任务详情与评论区活动
    const [detail, activities] = await Promise.all([
      api.get(`/api/v3/work_packages/${taskId}`, cookie),
      api.get(`/api/v3/work_packages/${taskId}/activities`, cookie).catch((e: any) => {
        // 404 表示任务无活动记录，返回空数据继续流程
        if (String(e.message).includes('404')) {
          return { _embedded: { elements: [] } }
        }
        throw e
      }),
    ])

    // 2. 组装任务上下文（描述去 HTML 并截断，控制 token 体积）
    const embedded = detail?._embedded || {}
    const ctx = {
      title: detail?.subject || '',
      status: embedded.status?.name || detail?._links?.status?.title || '',
      type: embedded.type?.name || detail?._links?.type?.title || '',
      description: toPlainText(detail?.description?.raw || '').slice(0, MAX_DESCRIPTION_CHARS),
      comments: extractCommentText(activities).slice(0, MAX_COMMENTS_CHARS),
    }

    // 3. 调用 OpenAI 兼容 chat completions 接口
    const endpoint = baseUrl.trim().replace(/\/+$/, '') + '/chat/completions'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: model.trim(),
        temperature: 0,
        messages: [{ role: 'user', content: fillPrompt(prompt, ctx) }],
      }),
      signal: AbortSignal.timeout(timeoutSec * 1000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`AI 接口返回 HTTP ${res.status}${body ? `: ${body.slice(0, MAX_ERROR_BODY_CHARS)}` : ''}`)
    }
    const data: any = await res.json()
    const conclusion = data?.choices?.[0]?.message?.content
    if (!conclusion || !String(conclusion).trim()) throw new Error('AI 未返回审查结论')
    return { conclusion: String(conclusion).trim() }
  })
}

// #endregion
