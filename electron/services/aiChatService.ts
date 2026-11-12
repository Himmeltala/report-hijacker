/*
 * @Author: zhengrenfu
 * @Date: 2026-11-03 22:29:35
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-12 09:30:00
 * @FilePath: \electron\services\aiChatService.ts
 * @Description: AI 通用对话 IPC：只做参数校验与通道注册，请求逻辑见 aiClient
 */

import { ipcMain } from 'electron'
import type { AiChatParams, AiChatResult } from '@/types/ai'
import type { AppSettings } from '@electron/services/settingsService'
import { loadAiConfig, requestChatCompletion, toMessages } from '@electron/services/aiClient'
import { recordAiUsage } from '@electron/services/aiUsageService'

// #region IPC 注册

/**
 * 注册 AI 通用对话 IPC，连接配置统一读取全局设置
 * @param {() => AppSettings} deps.getSettings 获取当前设置实例
 * @param {() => string} deps.getStoreDir 获取当前档案的存储目录，用于记录用量
 */
export function setupAiChatIpc(deps: { getSettings: () => AppSettings; getStoreDir: () => string }): void {
  const { getSettings, getStoreDir } = deps

  ipcMain.handle('ai:chat', async (_e, params: AiChatParams): Promise<AiChatResult> => {
    const messages = toMessages(params)
    if (!messages.length) throw new Error('提示词为空')
    const config = loadAiConfig(getSettings())
    // 用量只用于记账，不随对话结果回传给渲染层
    const { usage, ...result } = await requestChatCompletion(config, messages, params)
    // 上游未返回用量时不记账，避免把 0 当成真实用量
    if (usage) {
      try {
        recordAiUsage(getStoreDir(), new Date(), usage)
      } catch (e) {
        // 记账失败不影响对话结果，只留日志
        console.error('[AI] 记录用量失败:', e)
      }
    }
    return result
  })
}

// #endregion
