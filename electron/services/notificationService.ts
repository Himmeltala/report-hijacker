/*
 * @Author: zhengrenfu
 * @Date: 2026-08-04
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04
 * @FilePath: \electron\services\notificationService.ts
 * @Description: 平台通知服务：通知拉取、工作包详情补全与已读标记 IPC
 */

import { ipcMain } from 'electron'
import type { ApiClient } from '@electron/services/apiClient'
import type { NotificationElement } from '@/types/api'
import { extractWpId } from '@electron/utils'

// #region 常量

/** 工作包详情补全请求的并发上限，防止大批量通知打爆平台接口 */
const DETAIL_CONCURRENCY = 5

/** 逐条标记已读的并发上限 */
const MARK_READ_CONCURRENCY = 5

// #endregion

// #region 已读标记

/**
 * 逐条标记已读
 *
 * 集合接口 POST /api/v3/notifications/read_ian 在这套部署上不可用：传 filters 数组报 500，
 * 改传 ids 会把账号下全部未读置为已读，不认传入的 id。定向标记只能走单条接口。
 * @param {ApiClient} api API 客户端
 * @param {number} id 通知 ID
 * @param {string} cookie 登录 Cookie
 */
async function markOneRead(api: ApiClient, id: number, cookie: string): Promise<void> {
  await api.post(`/api/v3/notifications/${id}/read_ian`, cookie, {})
}

// #endregion

// #region IPC 注册

/**
 * 注册通知相关 IPC
 * @param {object} api API 客户端
 */
export function setupNotificationIpc(api: ApiClient): void {
  // #region 通知拉取

  ipcMain.handle('api:fetchNotifications', async (_e, params) => {
    const { cookie, onlyUnread = true, pageSize = 100, offset = 1 } = params
    if (!cookie) throw new Error('缺少 cookie')

    let filters = '[]'
    if (onlyUnread) {
      filters = encodeURIComponent(JSON.stringify([{ readIAN: { operator: '=', values: ['f'] } }]))
    }
    const data: any = await api.get(
      `/api/v3/notifications?pageSize=${pageSize}&offset=${offset}&filters=${filters}`,
      cookie,
    )

    // 提取工作包 ID（仅局部使用，不写入原始元素）
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
      // 工作池限并发获取详情，避免单页最多 100 个 ID 同时请求触发平台限流
      const details: Array<any | null> = new Array(ids.length)
      let nextIndex = 0
      const worker = async () => {
        while (nextIndex < ids.length) {
          const index = nextIndex++
          details[index] = await api.get(`/api/v3/work_packages/${ids[index]}`, cookie).catch(() => null)
        }
      }
      await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, ids.length) }, () => worker()))
      for (let i = 0; i < ids.length; i++) {
        if (details[i]) wpMap[ids[i]] = details[i]
      }
    }

    // 构建携带业务字段的新元素（浅拷贝原始元素，不修改平台返回的原始数据对象）
    // 业务字段统一 _ 前缀，与平台字段隔离；原始 elements 保持原封不动
    const merged = elements.map((el) => {
      const wpId = wpIdByEl.get(el) || ''
      const detail = wpId ? wpMap[wpId] : null
      return {
        ...el,
        _wpId: wpId,
        _workPackageId: wpId ? Number(wpId) : null,
        _workPackageStatus: detail?._embedded?.status?.name || '',
        _workPackageType: detail?._links?.type?.title || detail?._embedded?.type?.name || '',
        _projectName: detail?._embedded?.project?.name || el._links?.project?.title || '',
      }
    })

    // 返回时仅替换 elements 数组为合并副本，其余响应字段保持平台原始值
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
    let nextIndex = 0
    const worker = async () => {
      while (nextIndex < ids.length) {
        const id = ids[nextIndex++]
        try {
          await markOneRead(api, id, cookie)
        } catch (e: any) {
          console.error(`[通知] 标记已读失败 ID=${id}:`, e.message)
          failed.push(id)
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(MARK_READ_CONCURRENCY, ids.length) }, () => worker()))

    // 部分失败时如实报错，避免界面把没标记成功的条目当成已读删掉
    if (failed.length > 0) {
      throw new Error(`标记已读失败 ${failed.length} 条：${failed.join('、')}`)
    }
    return { success: true, count: ids.length }
  })

  // #endregion
}

// #endregion
