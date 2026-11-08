/*
 * @Author: zhengrenfu
 * @Date: 2026-11-08 17:00:00
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-08 17:00:00
 * @FilePath: \src\types\history.ts
 * @Description: 历史任务领域模型类型定义
 */

import type { ReadonlyRawWorkPackage } from '@/types/remote'
import type { RawTaskFields } from '@/types/task'

// #region 取值枚举

/** 执行优先级：高、中、低 */
export type TaskPriority = 'high' | 'medium' | 'low'

/** 限时任务：今日、临时 */
export type TaskTimeLimit = 'today' | 'temp'

/** 同步状态：未同步、已同步 */
export type TaskSyncStatus = 'none' | 'synced'

// #endregion

// #region 历史任务

export interface HistoryTaskItem extends RawTaskFields {
  serId: string
  serDate: string
  // 落库后序号统一为数字
  rawSeq: number
  rawHandler: string
  rawText: string
  serSyncStatus: TaskSyncStatus
  serWorkPackageId: string | null
  // 远程原始数据，只读，平台字段原封不动
  remote: ReadonlyRawWorkPackage | null
  serSyncedAt: string | null
  // AI 审查结论，未执行 AI 审查时为 null
  serAiConclusion?: string | null
  // 任务优先级：高、中、低
  serPriority: TaskPriority | null
  // 限时任务：今日、临时
  serTimeLimit: TaskTimeLimit | null
  // 是否为延期任务（本地标记）
  serPostponed: boolean
  serPostponedReason: string
  serCreatedAt: string
  serUpdatedAt: string
}

/** 延期设置弹窗的表单 */
export interface PostponeForm {
  postponed: boolean
  postponedReason: string
}

/** 执行优先级弹窗的表单 */
export interface TaskPriorityForm {
  priority: TaskPriority | null
}

/** 限时任务弹窗的表单 */
export interface TaskTimeLimitForm {
  timeLimit: TaskTimeLimit | null
}

export interface HistoryDay {
  date: string
  tasks: HistoryTaskItem[]
  createdAt: string
  updatedAt: string
}

/**
 * 带日期字段的历史任务
 * 日期取自任务的文本日期或平台日期，聚合展示时按它归组与排序
 */
export type DatedTask = HistoryTaskItem & { serDate: string }

// #endregion
