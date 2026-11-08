/*
 * @Author: zhengrenfu
 * @Date: 2026-08-04
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-05 10:45:00
 * @FilePath: \electron\services\historyService.ts
 * @Description: 历史任务服务：历史数据读写、备份实现及历史 IPC
 */

import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { join, dirname } from 'path'
import { existsSync, copyFileSync, mkdirSync, readdirSync, rmSync, constants } from 'fs'
import { readJsonFile, readJsonFileAsync, extractWpId, writeJsonAtomic } from '@electron/utils'
import { readFile, stat } from 'fs/promises'
import { mapWithConcurrency } from '@electron/concurrency'
import { writeStoreValue } from '@electron/services/storeService'
import { pickOpenPath } from '@electron/services/fileService'
import { compareTaskOrder, type TaskOrderFields } from '@/services/taskOrder'
import { taskMatchesKeyword } from '@/services/taskSearch'
import {
  assertValidDate,
  historyFilePath,
  listHistoryDates,
  pruneEmptyDateDirs,
} from '@electron/services/historyPaths'
import type { ApiClient } from '@electron/services/apiClient'
import type { AppSettings } from '@electron/services/settingsService'
import type { HistoryDay, HistoryTaskItem } from '@/types/history'
import type { QueryHistoryParams, SyncableTask } from '@/types/ipc'

function copyDirSync(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true })
  const entries = readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

// 批量同步任务的并发请求上限
const SYNC_CONCURRENCY = 5

// 历史查询扫描文件的并发上限
const QUERY_CONCURRENCY = 8

// 历史日文件解析缓存上限（按天计），命中时省去读盘与 JSON 解析
const DAY_CACHE_LIMIT = 366

interface DayCacheEntry {
  mtimeMs: number
  size: number
  data: HistoryDay
}

// 按文件绝对路径缓存已解析的历史日数据，mtime 与大小变化时视为失效
const dayCache = new Map<string, DayCacheEntry>()

/**
 * 将缓存项移到队尾，维持最近最少使用顺序
 * @param {string} filePath 历史日文件绝对路径
 * @param {DayCacheEntry} entry 缓存项
 */
function touchDayCache(filePath: string, entry: DayCacheEntry): void {
  dayCache.delete(filePath)
  dayCache.set(filePath, entry)
}

/**
 * 清理超出上限的最旧缓存项
 */
function trimDayCache(): void {
  while (dayCache.size > DAY_CACHE_LIMIT) {
    const oldestKey = dayCache.keys().next().value
    if (oldestKey === undefined) break
    dayCache.delete(oldestKey)
  }
}

/**
 * 移除指定历史日文件的缓存，写入或删除后调用
 * @param {string} filePath 历史日文件绝对路径
 */
function invalidateDayCache(filePath: string): void {
  dayCache.delete(filePath)
}

/**
 * @param {string[]} dirs 备份目标目录列表
 * @returns {number} 成功备份的目录数量
 */
function performBackup(dirs: string[], getHistoryDir: () => string, getStoreDir: () => string): number {
  const historyDir = getHistoryDir()
  let ok = 0
  for (const dir of dirs) {
    try {
      copyDirSync(historyDir, dir)
      ok++
    } catch (e) {
      console.error('[Backup] 备份失败:', dir, e)
    }
  }
  // 全部备份失败时不更新备份时间，避免界面展示虚假的成功时间
  if (ok > 0) {
    writeStoreValue(getStoreDir(), 'lastBackupTime', new Date().toISOString(), 0)
  }
  return ok
}

/**
 * 读取单个历史日文件，命中缓存时跳过读盘与 JSON 解析
 * @param {string} filePath 历史日文件绝对路径
 * @param {string} keywordNeedle 关键词原文预筛串，为空表示不做关键词过滤
 * @returns {Promise<HistoryDay | null>} 解析后的日数据，文件不存在或损坏时返回 null
 */
async function readDayData(filePath: string, keywordNeedle: string): Promise<HistoryDay | null> {
  const fileStat = await stat(filePath).catch(() => null)
  if (!fileStat) return null

  const cached = dayCache.get(filePath)
  if (cached && cached.mtimeMs === fileStat.mtimeMs && cached.size === fileStat.size) {
    touchDayCache(filePath, cached)
    return cached.data
  }

  let data: HistoryDay | null
  if (keywordNeedle) {
    // 先按原文粗筛，未命中的文件直接跳过 JSON 解析
    const text = await readFile(filePath, 'utf-8').catch(() => '')
    if (!text.includes(keywordNeedle) && !text.toLowerCase().includes(keywordNeedle)) return null
    data = JSON.parse(text)
  } else {
    data = await readJsonFileAsync<HistoryDay | null>(filePath, null)
  }

  if (data) {
    dayCache.set(filePath, { mtimeMs: fileStat.mtimeMs, size: fileStat.size, data })
    trimDayCache()
  }
  return data
}

/**
 * 注册历史任务相关 IPC
 * @param {() => AppSettings} deps.getSettings 获取当前设置实例（档案切换后可能被替换）
 */
export function setupHistoryIpc(deps: {
  api: ApiClient
  getSettings: () => AppSettings
  getHistoryDir: () => string
  getStoreDir: () => string
  getWindow: () => BrowserWindow | null
}): void {
  const { api, getSettings, getHistoryDir, getStoreDir, getWindow } = deps

  ipcMain.handle('history:listDates', (_e, range?: QueryHistoryParams) => {
    if (range?.startDate) assertValidDate(range.startDate)
    if (range?.endDate) assertValidDate(range.endDate)
    return listHistoryDates(getHistoryDir(), range).sort().reverse()
  })

  ipcMain.handle('history:getDate', (_e, date: string) => {
    assertValidDate(date)
    return readJsonFile<HistoryDay | null>(historyFilePath(getHistoryDir(), date), null)
  })

  ipcMain.handle('history:saveDate', (_e, date: string, data: HistoryDay) => {
    assertValidDate(date)
    const filePath = historyFilePath(getHistoryDir(), date)
    data.updatedAt = new Date().toISOString()
    writeJsonAtomic(filePath, data)
    invalidateDayCache(filePath)
  })

  ipcMain.handle('history:batchSave', (_e, batch: Array<{ date: string; data: HistoryDay }>) => {
    const historyDir = getHistoryDir()
    const now = new Date().toISOString()
    for (const item of batch) {
      assertValidDate(item.date)
      const filePath = historyFilePath(historyDir, item.date)
      item.data.updatedAt = now
      writeJsonAtomic(filePath, item.data)
      invalidateDayCache(filePath)
    }
  })

  ipcMain.handle('history:deleteDate', (_e, date: string) => {
    assertValidDate(date)
    const historyDir = getHistoryDir()
    const filePath = historyFilePath(historyDir, date)
    if (existsSync(filePath)) rmSync(filePath)
    invalidateDayCache(filePath)
    pruneEmptyDateDirs(historyDir, date)
  })

  ipcMain.handle('history:query', async (_e, params: QueryHistoryParams | undefined) => {
    const { startDate, endDate, keyword } = params || {}
    const historyDir = getHistoryDir()
    const kw = keyword?.trim().toLowerCase() || ''
    // 原文预筛用 JSON 转义后的关键字，避免引号等字符导致漏命中
    const needle = kw ? JSON.stringify(kw).slice(1, -1) : ''
    const dates = listHistoryDates(historyDir)
      .filter((date) => (!startDate || date >= startDate) && (!endDate || date <= endDate))
      .sort()

    // 并发读取并设上限，避免阻塞主进程
    const results = await mapWithConcurrency(dates, QUERY_CONCURRENCY, async (date) => {
      const filePath = historyFilePath(historyDir, date)
      try {
        const raw = await readDayData(filePath, needle)
        if (!raw?.tasks?.length) return null
        // 复制任务数组，避免关键词过滤与排序改写缓存中的原数据
        const data = { ...raw, tasks: [...raw.tasks] }
        if (kw) data.tasks = data.tasks.filter((t: HistoryTaskItem) => taskMatchesKeyword(t, kw))
        return data.tasks.length > 0 ? data : null
      } catch (e) {
        console.error('[History] 跳过损坏文件:', e)
        return null
      }
    })

    const days = results.filter((d): d is HistoryDay => d !== null)
    // 日期升序返回，日期内按平台状态与类型排序
    for (const day of days) {
      const orderFields = (t: HistoryTaskItem): TaskOrderFields => ({
        status: t.remote?._embedded?.status?.name,
        type: t.remote?._embedded?.type?.name,
        date: day.date,
        seq: t.rawSeq,
      })
      day.tasks.sort((a, b) => compareTaskOrder(orderFields(a), orderFields(b)))
    }
    return days
  })

  // 批量同步任务到管理平台（工作池限并发，避免大批量同步打爆平台接口）
  ipcMain.handle('history:syncTasks', async (_e, tasks: SyncableTask[], cookie: string) => {
    return mapWithConcurrency(tasks, SYNC_CONCURRENCY, async (task) => {
      const wpId = task.serWorkPackageId || extractWpId(task.rawUrl)
      if (!wpId) {
        return { taskId: task.serId, workPackageId: null, exists: false, remote: null }
      }
      try {
        const detail = await api.getWorkPackage(wpId, cookie)
        return { taskId: task.serId, workPackageId: wpId, exists: true, remote: detail }
      } catch (e) {
        return {
          taskId: task.serId,
          workPackageId: wpId,
          exists: false,
          remote: null,
          error: (e as Error).message,
        }
      }
    })
  })

  ipcMain.handle('history:restoreFromDir', async () => {
    const srcDir = await pickOpenPath(getWindow, {
      title: '选择备份目录',
      properties: ['openDirectory'],
    })
    if (!srcDir) return { count: 0 }
    const historyDir = getHistoryDir()
    // 备份目录与历史目录使用同一套 年/月 布局，按日期逐个恢复
    let count = 0
    for (const date of listHistoryDates(srcDir)) {
      const destPath = historyFilePath(historyDir, date)
      try {
        mkdirSync(dirname(destPath), { recursive: true })
        copyFileSync(historyFilePath(srcDir, date), destPath, constants.COPYFILE_FICLONE)
        count++
      } catch (e) {
        console.error('[History] 恢复文件失败:', e)
        // 跳过单个失败
      }
    }
    // 恢复的文件不经过写入接口，直接整体清空缓存
    dayCache.clear()
    return { count }
  })

  ipcMain.handle('history:backupNow', async (_e, dirs?: string[]) => {
    const backupDirs = dirs || getSettings().get('history.backupDirectories', [])
    if (!backupDirs.length) return { success: false, message: '未设置备份目录' }
    const now = new Date().toISOString()
    const ok = performBackup(backupDirs, getHistoryDir, getStoreDir)
    return { success: ok > 0, count: ok, total: backupDirs.length, time: now }
  })
}

export { performBackup }
