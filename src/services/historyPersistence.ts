/*
 * @Author: zhengrenfu
 * @Date: 2026-08-04 01:41:36
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04 12:14:04
 * @FilePath: \src\services\historyPersistence.ts
 * @Description: 历史数据持久化服务：按日期归组、磁盘合并去重、孤儿文件清理
 */

import type { HistoryDay, HistoryTaskItem } from '@/types/ipc'
import { ipc } from '@/utils/ipc'

// #region 辅助函数

/**
 * 安全的深层克隆，处理循环引用
 * OpenProject API 返回的 remote 对象 _links 包含自引用，JSON.stringify 会抛异常
 * @param {any} obj 需要克隆的对象
 * @returns {any} 克隆后的对象
 */
function safeClone(obj: any): any {
  const seen = new WeakSet()
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]'
        seen.add(value)
      }
      return value
    }),
  )
}

/**
 * 判断两个任务 ID 集合是否一致
 * @param {Set<string>} a 任务 ID 集合
 * @param {Set<string>} b 任务 ID 集合
 * @returns {boolean} 是否一致
 */
function sameIdSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) {
    if (!b.has(id)) return false
  }
  return true
}

/**
 * 生成任务内容的比较快照，剔除日期、时间戳、remote 等不会触发业务变更的字段
 * remote 来自平台 API，只读不修改，且含 _links 循环引用无法 JSON.stringify
 * @param {any} task 任务对象
 * @returns {string} 任务内容的 JSON 序列化结果
 */
function taskSnapshot(task: any): string {
  const copy: any = { ...task }
  delete copy.serDate
  delete copy.serCreatedAt
  delete copy.serUpdatedAt
  delete copy.remote
  delete copy.serCheckResult
  delete copy.serCommentCheckResult
  return JSON.stringify(copy)
}

/**
 * 比较两组任务内容是否一致（按任务 ID 配对比较）
 * @param {any[]} a 任务列表
 * @param {any[]} b 任务列表
 * @returns {boolean} 内容是否一致
 */
function sameTasksContent(a: any[], b: any[]): boolean {
  if (a.length !== b.length) return false
  const mapB = new Map(b.map((t: any) => [t.serId, t]))
  for (const ta of a) {
    const tb = mapB.get(ta.serId)
    if (!tb) return false
    if (taskSnapshot(ta) !== taskSnapshot(tb)) return false
  }
  return true
}

// #endregion

// #region 追加保存

/**
 * 把任务追加进指定日期的历史文件，按 rawUrl 判重，序号续接已有最大值
 * 提取页与工作台共用，保证两处的判重规则一致
 * @param {string} date 保存日期（YYYY-MM-DD）
 * @param {HistoryTaskItem[]} tasks 待保存任务
 * @returns {Promise<number>} 实际新增的条数
 */
export async function mergeTasksIntoHistory(date: string, tasks: HistoryTaskItem[]): Promise<number> {
  const now = new Date().toISOString()
  // 空 URL 的任务无法判重，始终保留；批内先按 URL 去重，保留首次出现
  const seenUrls = new Set<string>()
  const uniqueTasks = tasks.filter((t) => {
    if (!t.rawUrl) return true
    if (seenUrls.has(t.rawUrl)) return false
    seenUrls.add(t.rawUrl)
    return true
  })

  const existing = await ipc.getHistoryDate(date)
  if (existing) {
    const existingUrls = new Set(existing.tasks.map((t) => t.rawUrl).filter(Boolean))
    const newTasks = uniqueTasks.filter((t) => !existingUrls.has(t.rawUrl))
    const maxSeq = existing.tasks.reduce((max, t) => Math.max(max, t.rawSeq || 0), 0)
    newTasks.forEach((t, i) => {
      t.rawSeq = maxSeq + i + 1
    })
    existing.tasks.push(...newTasks)
    existing.updatedAt = now
    await ipc.saveHistoryDate(date, existing)
    return newTasks.length
  }

  await ipc.saveHistoryDate(date, { date, tasks: uniqueTasks, createdAt: now, updatedAt: now })
  return uniqueTasks.length
}

// #endregion

// #region 持久化主函数

/**
 * 将内存中的日期数据持久化到磁盘
 * 处理流程：按 _date 重新归组、与磁盘已有数据按任务 ID 去重合并
 * （并行读取）、内容无变化时跳过写入、并行保存/删除、清理孤儿文件
 * @param {HistoryDay[]} loadedDays 内存中的日期数据列表
 * @returns {Promise<HistoryDay[]>} 归组后的新日期数据列表
 */
export async function flushHistoryChanges(loadedDays: HistoryDay[]): Promise<HistoryDay[]> {
  // #region 数据准备

  const allTaskIds = new Set<string>()
  const originalDates = new Set<string>()
  for (const day of loadedDays) {
    originalDates.add(day.date)
    for (const t of day.tasks) {
      allTaskIds.add((t as any).serId)
    }
  }

  // 按 _date 重新归组
  const map = new Map<string, any[]>()
  for (const day of loadedDays) {
    for (const t of day.tasks) {
      const key = (t as any).serDate || day.date
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
  }

  // 并行读取范围内的磁盘数据
  const allDates = new Set([...map.keys(), ...originalDates])
  const diskData = await Promise.all(
    Array.from(allDates).map(async (date) => ({ date, day: await ipc.getHistoryDate(date) })),
  )
  const diskByDate = new Map(diskData.map((d) => [d.date, d.day]))

  const now = new Date().toISOString()
  const newDays: HistoryDay[] = []
  const newDateSet = new Set<string>()
  for (const [date, tasks] of map) {
    newDays.push({ date, tasks, createdAt: now, updatedAt: now })
    newDateSet.add(date)
  }

  // #endregion

  // #region 合并与去重

  // 合并磁盘已有数据（按任务 ID 去重），内容无变化时跳过写入
  const saveBatch: Array<{ date: string; data: HistoryDay }> = []
  const deleteDates: string[] = []

  for (const day of newDays) {
    const existing = diskByDate.get(day.date)
    if (existing && existing.tasks.length > 0) {
      const existingIds = new Set(existing.tasks.map((t: any) => t.serId))
      const mergedIds = new Set(day.tasks.map((t: any) => t.serId))
      for (const t of existing.tasks) {
        if (!allTaskIds.has((t as any).serId)) {
          day.tasks.push(t)
          mergedIds.add(t.serId)
        }
      }
      // 任务 ID 与内容均无变化时跳过写入；内容有差异（编辑、延期、检查、同步回写）必须落盘
      if (sameIdSet(existingIds, mergedIds) && sameTasksContent(day.tasks, existing.tasks)) {
        continue
      }
      // 已有日期保留原始 createdAt
      if (existing.createdAt) day.createdAt = existing.createdAt
    }
    saveBatch.push({ date: day.date, data: safeClone(day) })
  }

  for (const date of originalDates) {
    if (newDateSet.has(date)) continue
    const existing = diskByDate.get(date)
    if (!existing) continue
    const remaining = existing.tasks.filter((t: any) => !allTaskIds.has(t.serId))
    if (remaining.length > 0) {
      existing.tasks = remaining
      saveBatch.push({ date, data: existing })
    } else {
      deleteDates.push(date)
    }
  }

  // #endregion

  // #region 持久化操作

  // 并行保存与删除
  if (saveBatch.length > 0) {
    await ipc.batchSaveHistory(saveBatch)
  }
  await Promise.all(deleteDates.map((date) => ipc.deleteHistoryDate(date)))

  // 清理孤儿文件（防御性：正常流程不会产生空文件）
  const alive = new Set([...newDateSet, ...originalDates])
  const allFiles = await ipc.listHistoryDates()
  const orphans = allFiles.filter((d) => !alive.has(d))
  await Promise.all(
    orphans.map(async (d) => {
      const existing = await ipc.getHistoryDate(d)
      if (!existing || existing.tasks.length === 0) {
        await ipc.deleteHistoryDate(d)
      }
    }),
  )

  // #endregion

  return newDays
}

// #endregion
