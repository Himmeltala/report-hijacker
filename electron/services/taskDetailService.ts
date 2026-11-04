/*
 * @Author: zhengrenfu
 * @Date: 2026-11-04 14:20:00
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 14:21:53
 * @FilePath: \electron\services\taskDetailService.ts
 * @Description: 任务详情与评论区获取 IPC，供 AI 审查取数与页面展示平台字段
 */

import { ipcMain } from 'electron'
import type { ApiClient } from '@electron/services/apiClient'
import { extractWpId } from '@electron/utils'

// #region IPC 注册

/**
 * 注册任务详情与评论区获取 IPC
 * @param {ApiClient} api API 客户端
 */
export function setupTaskDetailIpc(api: ApiClient): void {
  ipcMain.handle('api:fetchTaskDetail', async (_e, params: { rawUrl: string; cookie: string }) => {
    const { rawUrl, cookie } = params
    const taskId = extractWpId(rawUrl) || ''
    if (!taskId) return { serTaskId: '', serError: '无法从链接提取任务ID' }

    try {
      // 透传完整原始 API 响应，不裁剪字段
      const remote = await api.get(`/api/v3/work_packages/${taskId}`, cookie)
      return { serTaskId: taskId, remote }
    } catch (e: any) {
      return { serTaskId: taskId, serError: `获取任务详情失败: ${e.message}` }
    }
  })

  ipcMain.handle('api:checkComments', async (_e, params) => {
    const { taskId, cookie } = params
    if (!taskId || !cookie) throw new Error('缺少 taskId 或 cookie')

    try {
      // 透传完整原始 API 响应，不裁剪字段
      return await api.get(`/api/v3/work_packages/${taskId}/activities`, cookie)
    } catch (e: any) {
      // 404 表示任务无活动记录，返回空数据
      if (String(e.message).includes('404')) {
        return { _type: 'Collection', total: 0, count: 0, _embedded: { elements: [] }, _links: {} }
      }
      throw e
    }
  })
}

// #endregion
