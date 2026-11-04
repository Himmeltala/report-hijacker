/*
 * @Author: zhengrenfu
 * @Date: 2026-11-04 14:20:00
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 14:21:53
 * @FilePath: \src\utils\taskDetail.ts
 * @Description: 任务详情与评论区取数（IPC 透传层）
 */

import type { TaskDetailResult } from '@/types/task'
import type { ActivitiesResponse } from '@/types/api'
import type { FetchTaskDetailParams } from '@/types/ipc'

// #region 任务详情

/**
 * 拉取单个任务的平台详情
 * @param {string} rawUrl 任务链接
 * @param {string} cookie 登录 Cookie
 * @returns {Promise<TaskDetailResult>} 任务详情，失败时带 serError
 */
export async function fetchTaskDetail(rawUrl: string, cookie: string): Promise<TaskDetailResult> {
  const params: FetchTaskDetailParams = { rawUrl, cookie }
  return window.electron.fetchTaskDetail(params)
}

// #endregion

// #region 评论区

/**
 * 获取任务评论区原始数据（透传 API 响应）
 * 响应含 _embedded.elements[]._type 与 comment.raw 字段
 * @param {string} taskId 任务 ID
 * @param {string} cookie 登录 Cookie
 * @returns {Promise<ActivitiesResponse>} 活动列表响应
 */
export async function checkComments(taskId: string, cookie: string): Promise<ActivitiesResponse> {
  return window.electron.checkComments({ taskId, cookie })
}

// #endregion
