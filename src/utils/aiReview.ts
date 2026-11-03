/*
 * @Author: zhengrenfu
 * @Date: 2026-11-03
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-03
 * @FilePath: \src\utils\aiReview.ts
 * @Description: AI 任务审查函数（IPC 透传层）
 */

import type { AiReviewParams } from '@/types/ipc'

// #region AI 审查

/**
 * 对单个任务执行 AI 审查（调用主进程审查接口，模型与提示词配置由主进程读取）
 * @param {string} taskId 任务 ID
 * @param {string} cookie 登录 Cookie
 * @returns {Promise<{conclusion: string}>} 审查结论
 */
export async function aiReviewTask(taskId: string, cookie: string): Promise<{ conclusion: string }> {
  const params: AiReviewParams = { taskId, cookie }
  return window.electron.aiReview(params)
}

// #endregion
