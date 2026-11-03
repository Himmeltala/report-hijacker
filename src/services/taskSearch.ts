/*
 * @Author: Himmeltala
 * @Date: 2026-10-30 09:58:14
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-10-30 09:58:14
 * @FilePath: \src\services\taskSearch.ts
 * @Description: 任务关键字匹配，主进程查询与渲染端过滤共用同一套口径
 */

/** 参与关键字匹配的任务字段 */
export interface SearchableTask {
  rawProjectName?: string
  rawTitle?: string
  rawHandler?: string
  rawUrl?: string
  rawRemark?: string
}

/**
 * 判断任务是否命中关键字
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
