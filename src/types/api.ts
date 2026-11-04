/*
 * @Author: zhengrenfu
 * @Date: 2026-07-16 21:36:19
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-07-16 12:14:04
 * @FilePath: \src\types\api.ts
 * @Description: OpenProject API 响应类型定义
 */

// #region 通知相关

export interface NotificationElement {
  _type: string
  id: number
  readIAN: boolean
  reason: string
  createdAt: string
  updatedAt: string
  _embedded: {
    details: Array<{
      format: string
      raw: string
      html: string
    }>
  }
  _links: {
    self: { href: string }
    readIAN: { href: string; method: string }
    actor: { href: string; title: string }
    project: { href: string; title: string }
    activity: { href: string }
    resource: { href: string; title: string }
  }

  // 后端合并的 work_package 详情
  _workPackageId: number | null
  _workPackageStatus: string
  _workPackageType: string
  _projectName: string
}

export interface NotificationsResponse {
  _type: string
  total: number
  count: number
  pageSize: number
  offset: number
  _embedded: {
    elements: NotificationElement[]
  }
  _links: Record<string, any>
}

// #endregion

// #region 活动与评论相关

export interface ActivityElement {
  _type: string
  id: number
  comment: {
    format: string
    raw: string
    html: string
  }
  details: Array<{
    format: string
    raw: string
    html: string
  }>
  version: number
  createdAt: string
  updatedAt: string
  _links: Record<string, any>
}

export interface ActivitiesResponse {
  _type: string
  total: number
  count: number
  _embedded: {
    elements: ActivityElement[]
  }
  _links: Record<string, any>
}

// #endregion
