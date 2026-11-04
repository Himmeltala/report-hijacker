/*
 * @Author: zhengrenfu
 * @Date: 2026-11-03 22:29:35
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 14:21:53
 * @FilePath: \electron\services\aiChatService.ts
 * @Description: AI 通用对话 IPC：统一连接配置调用 OpenAI 兼容大模型，供各业务模块复用
 */

import { ipcMain } from 'electron'
import type { AppSettings } from '@electron/services/settingsService'

// #region 常量

// 错误响应截断，避免大段错误内容进日志
const MAX_ERROR_BODY_CHARS = 200

// 保证结论稳定可复现
const CHAT_TEMPERATURE = 0

// #endregion

// #region IPC 注册

/**
 * 注册 AI 通用对话 IPC，连接配置统一读取全局设置
 * @param {() => AppSettings} deps.getSettings 获取当前设置实例
 */
export function setupAiChatIpc(deps: { getSettings: () => AppSettings }): void {
  const { getSettings } = deps

  ipcMain.handle('ai:chat', async (_e, params: { prompt: string }) => {
    const prompt = params?.prompt || ''
    if (!prompt.trim()) throw new Error('提示词为空')
    const s = getSettings()

    const enabled = s.get('ai.enabled', false)
    if (!enabled) throw new Error('AI 未启用，请在设置中开启')
    const baseUrl = String(s.get('ai.baseUrl', '')).trim()
    const apiKey = String(s.get('ai.apiKey', '')).trim()
    const model = String(s.get('ai.model', '')).trim()
    const timeoutSec = Number(s.get('ai.timeoutSeconds', 120)) || 120

    if (!baseUrl) throw new Error('未配置 AI 接口地址')
    if (!apiKey) throw new Error('未配置 API 密钥')
    if (!model) throw new Error('未配置模型名称')

    const endpoint = baseUrl.replace(/\/+$/, '') + '/chat/completions'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: CHAT_TEMPERATURE,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(timeoutSec * 1000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`AI 接口返回 HTTP ${res.status}${body ? `: ${body.slice(0, MAX_ERROR_BODY_CHARS)}` : ''}`)
    }
    const data: any = await res.json()
    const message = data?.choices?.[0]?.message
    const text = message?.content
    if (!text || !String(text).trim()) throw new Error('AI 未返回内容')
    // 推理模型单独返回思考过程，非推理模型为空
    const reasoning = message?.reasoning_content ? String(message.reasoning_content).trim() : ''
    return { text: String(text).trim(), reasoning }
  })
}

// #endregion
