/*
 * @Author: Himmeltala
 * @Date: 2026-10-30 09:58:14
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-10-30 09:58:14
 * @FilePath: \src\services\taskSearch.ts
 * @Description: 任务关键字匹配，主进程查询与渲染端过滤共用同一套口径
 */

import type { RawTaskFields } from '@/types/task'

/** 关键字匹配只看任务的可搜索文本字段，全部可选以兼容任意任务形状 */
export type SearchableTask = Partial<Pick<RawTaskFields, 'rawProjectName' | 'rawTitle' | 'rawUrl' | 'rawRemark'>> & {
  rawHandler?: string
}

/**
 * @param task 任务
 * @param keyword 关键字，空串表示命中全部
 * @returns 是否命中
 */
export function taskMatchesKeyword(task: SearchableTask, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return true
  return [task.rawProjectName, task.rawTitle, task.rawHandler, task.rawUrl, task.rawRemark].some((value) =>
    (value || '').toLowerCase().includes(kw),
  )
}
