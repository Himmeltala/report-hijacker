/*
 * @Author: Himmeltala
 * @Date: 2026-11-05 10:30:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-06 08:50:00
 * @FilePath: \electron\services\openProjectService.ts
 * @Description: OpenProject 取数服务：任务详情、评论区与平台通知 IPC
 */

import { ipcMain } from 'electron'
import type { ApiClient } from '@electron/services/apiClient'
import type { NotificationElement } from '@/types/api'
import { extractWpId } from '@electron/utils'
import { mapWithConcurrency } from '@electron/concurrency'
import { getErrorMessage } from '@/utils/error'

// 工作包详情补全请求的并发上限，防止大批量通知打爆平台接口
const DETAIL_CONCURRENCY = 10

// 通知列表请求超时：列表带过滤条件时平台偶发慢响应，按单次请求 15 秒算太容易整体超时
const LIST_TIMEOUT_MS = 60_000

// 单条工作包详情超时：超时按取数失败处理（退回通知自带字段），不让个别慢请求拖垮整页
const DETAIL_TIMEOUT_MS = 10_000

// 逐条标记已读的并发上限
const MARK_READ_CONCURRENCY = 5

// 判断是否为请求超时（AbortSignal.timeout 抛 TimeoutError）
function isTimeoutError(e: unknown): boolean {
  const err = e as { name?: unknown; message?: unknown } | null | undefined
  return err?.name === 'TimeoutError' || /aborted due to timeout|timeout/i.test(String(err?.message || ''))
}

// 逐条标记已读：这套部署的集合接口 read_ian 不可用，定向标记只能走单条
async function markOneRead(api: ApiClient, id: number, cookie: string): Promise<void> {
  await api.post(`/api/v3/notifications/${id}/read_ian`, cookie, {})
}

// 注册任务详情、评论区与平台通知 IPC
export function setupOpenProjectIpc(api: ApiClient): void {
  // #region 任务详情与评论区

  ipcMain.handle('api:fetchTaskDetail', async (_e, params: { rawUrl: string; cookie: string }) => {
    const { rawUrl, cookie } = params
    const taskId = extractWpId(rawUrl) || ''
    if (!taskId) return { serTaskId: '', serError: '无法从链接提取任务ID' }

    try {
      // 透传完整原始 API 响应，不裁剪字段
      const remote = await api.getWorkPackage(taskId, cookie)
      return { serTaskId: taskId, remote }
    } catch (e) {
      return { serTaskId: taskId, serError: `获取任务详情失败: ${getErrorMessage(e)}` }
    }
  })

  ipcMain.handle('api:checkComments', async (_e, params) => {
    const { taskId, cookie } = params
    if (!taskId || !cookie) throw new Error('缺少 taskId 或 cookie')

    try {
      // 透传完整原始 API 响应，不裁剪字段
      return await api.get(`/api/v3/work_packages/${taskId}/activities`, cookie)
    } catch (e) {
      // 404 表示任务无活动记录，返回空数据
      if (getErrorMessage(e).includes('404')) {
        return { _type: 'Collection', total: 0, count: 0, _embedded: { elements: [] }, _links: {} }
      }
      throw e
    }
  })

  // #endregion

  // #region 通知拉取

  ipcMain.handle('api:fetchNotifications', async (_e, params) => {
    const { cookie, onlyUnread = true, pageSize = 100, offset = 1 } = params
    if (!cookie) throw new Error('缺少 cookie')

    let filters = '[]'
    if (onlyUnread) {
      filters = encodeURIComponent(JSON.stringify([{ readIAN: { operator: '=', values: ['f'] } }]))
    }
    // 列表请求放宽超时，超时时给出明确提示，避免整条 IPC 抛原始 TimeoutError
    let data: any
    try {
      data = await api.get(
        `/api/v3/notifications?pageSize=${pageSize}&offset=${offset}&filters=${filters}`,
        cookie,
        { timeoutMs: LIST_TIMEOUT_MS },
      )
    } catch (e) {
      if (isTimeoutError(e)) throw new Error('通知列表请求超时（60 秒），平台响应较慢，请稍后重试')
      throw e
    }

    // 提取工作包 ID，不写入原始元素
    const elements = data._embedded?.elements || []
    const wpIdByEl = new Map<NotificationElement, string>()
    const wpIdSet = new Set<string>()
    for (const el of elements) {
      const id = extractWpId(el._links?.resource?.href || '')
      if (id) {
        wpIdSet.add(id)
        wpIdByEl.set(el, id)
      }
    }
    const wpMap: Record<string, any> = {}
    if (wpIdSet.size > 0) {
      const ids = Array.from(wpIdSet)
      // 限并发获取工作包详情，避免触发平台限流；单条超时快速失败，不拖慢整页
      const details = await mapWithConcurrency(ids, DETAIL_CONCURRENCY, (id) =>
        api.getWorkPackage(id, cookie, { timeoutMs: DETAIL_TIMEOUT_MS }).catch(() => null),
      )
      for (let i = 0; i < ids.length; i++) {
        if (details[i]) wpMap[ids[i]] = details[i]
      }
    }

    // 构建携带业务字段的新元素，_ 前缀与平台字段隔离，不修改原始数据
    const merged = elements.map((el) => {
      const wpId = wpIdByEl.get(el) || ''
      const detail = wpId ? wpMap[wpId] : null
      return {
        ...el,
        _workPackageId: wpId ? Number(wpId) : null,
        _workPackageStatus: detail?._embedded?.status?.name || '',
        _workPackageType: detail?._links?.type?.title || detail?._embedded?.type?.name || '',
        _projectName: detail?._embedded?.project?.name || el._links?.project?.title || '',
      }
    })

    // 仅替换 elements 为合并副本，其余字段保持平台原始值
    return {
      ...data,
      _embedded: {
        ...data._embedded,
        elements: merged,
      },
    }
  })

  // #endregion

  // #region 已读标记

  ipcMain.handle('api:markNotificationRead', async (_e, params) => {
    const { id, cookie } = params
    if (!id || !cookie) throw new Error('缺少 id 或 cookie')
    await markOneRead(api, id, cookie)
    return { success: true }
  })

  // 多 id 标记：受限于平台接口，逐条请求，控制并发避免触发限流
  ipcMain.handle('api:markNotificationsRead', async (_e, params) => {
    const { ids, cookie } = params
    if (!ids?.length || !cookie) throw new Error('缺少 ids 或 cookie')

    const failed: number[] = []
    await mapWithConcurrency(ids, MARK_READ_CONCURRENCY, async (id: number) => {
      try {
        await markOneRead(api, id, cookie)
      } catch (e) {
        console.error(`[通知] 标记已读失败 ID=${id}:`, getErrorMessage(e))
        failed.push(id)
      }
    })

    // 部分失败时如实报错，避免界面把没标记成功的条目当成已读删掉
    if (failed.length > 0) {
      throw new Error(`标记已读失败 ${failed.length} 条：${failed.join('、')}`)
    }
    return { success: true, count: ids.length }
  })

  // #endregion
}
