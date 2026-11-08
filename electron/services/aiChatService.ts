/*
 * @Author: zhengrenfu
 * @Date: 2026-11-03 22:29:35
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-08 16:20:00
 * @FilePath: \electron\services\aiChatService.ts
 * @Description: AI 通用对话 IPC：只做参数校验与通道注册，请求逻辑见 aiClient
 */

import { ipcMain } from 'electron'
import type { AiChatParams, AiChatResult } from '@/types/ai'
import type { AppSettings } from '@electron/services/settingsService'
import { loadAiConfig, requestChatCompletion, toMessages } from '@electron/services/aiClient'

// #region IPC 注册

/**
 * 注册 AI 通用对话 IPC，连接配置统一读取全局设置
 * @param {() => AppSettings} deps.getSettings 获取当前设置实例
 */
export function setupAiChatIpc(deps: { getSettings: () => AppSettings }): void {
  const { getSettings } = deps

  ipcMain.handle('ai:chat', async (_e, params: AiChatParams): Promise<AiChatResult> => {
    const messages = toMessages(params)
    if (!messages.length) throw new Error('提示词为空')
    const config = loadAiConfig(getSettings())
    return requestChatCompletion(config, messages, params)
  })
}

// #endregion
