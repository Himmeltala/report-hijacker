/*
 * @Author: zhengrenfu
 * @Date: 2026-08-04
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-10-30 09:58:14
 * @FilePath: \electron\services\historyService.ts
 * @Description: 历史任务服务：历史数据读写、备份定时器及历史 IPC
 */

import { ipcMain, dialog } from 'electron'
import { join, dirname } from 'path'
import { existsSync, writeFileSync, copyFileSync, mkdirSync, readdirSync, rmSync, renameSync, constants } from 'fs'
import { readJsonFile, readJsonFileAsync, listJsonFilesRecursive, extractWpId } from '@electron/utils'
import { readFile } from 'fs/promises'
import { compareTaskOrder } from '@/services/taskOrder'
import { taskMatchesKeyword } from '@/services/taskSearch'
import { migrateHistoryLayout } from '@electron/migrations/migrateHistoryLayout'
import {
  assertValidDate,
  historyFilePath,
  listHistoryDates,
  pickRestoreSources,
  pruneEmptyDateDirs,
} from '@electron/services/historyPaths'
import type { ApiClient } from '@electron/services/apiClient'

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

/** 批量同步任务的并发请求上限 */
const SYNC_CONCURRENCY = 5

/** 历史查询扫描文件的并发上限 */
const QUERY_CONCURRENCY = 8

/**
 * 原子写入 JSON 文件：先写临时文件再重命名，崩溃时不会留下截断的目标文件
 * @param {string} filePath 目标文件路径
 * @param {any} data 待写入的数据
 */
function writeJsonAtomic(filePath: string, data: any): void {
  mkdirSync(dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.tmp`
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  renameSync(tmpPath, filePath)
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
    writeFileSync(join(getStoreDir(), 'lastBackupTime.json'), JSON.stringify(new Date().toISOString()), 'utf-8')
  }
  return ok
}

/**
 * 注册历史任务相关 IPC
 * @param {() => any} deps.getSettings 获取当前设置实例（档案切换后可能被替换）
 */
export function setupHistoryIpc(deps: {
  api: ApiClient
  getSettings: () => any
  getHistoryDir: () => string
  getStoreDir: () => string
  performBackupFn: (dirs: string[], getHistoryDir: () => string, getStoreDir: () => string) => number
  restartBackup: () => void
}): void {
  const { api, getSettings, getHistoryDir, getStoreDir, performBackupFn } = deps

  ipcMain.handle('history:listDates', (_e, range?: { startDate?: string; endDate?: string }) => {
    if (range?.startDate) assertValidDate(range.startDate)
    if (range?.endDate) assertValidDate(range.endDate)
    return listHistoryDates(getHistoryDir(), range).sort().reverse()
  })

  ipcMain.handle('history:getDate', (_e, date: string) => {
    assertValidDate(date)
    return readJsonFile<any>(historyFilePath(getHistoryDir(), date), null)
  })

  ipcMain.handle('history:saveDate', (_e, date: string, data: any) => {
    assertValidDate(date)
    data.updatedAt = new Date().toISOString()
    writeJsonAtomic(historyFilePath(getHistoryDir(), date), data)
  })

  ipcMain.handle('history:batchSave', (_e, batch: Array<{ date: string; data: any }>) => {
    const historyDir = getHistoryDir()
    const now = new Date().toISOString()
    for (const item of batch) {
      assertValidDate(item.date)
      item.data.updatedAt = now
      writeJsonAtomic(historyFilePath(historyDir, item.date), item.data)
    }
  })

  ipcMain.handle('history:deleteDate', (_e, date: string) => {
    assertValidDate(date)
    const historyDir = getHistoryDir()
    const filePath = historyFilePath(historyDir, date)
    if (existsSync(filePath)) rmSync(filePath)
    pruneEmptyDateDirs(historyDir, date)
  })

  ipcMain.handle('history:migrateLayout', () => {
    return migrateHistoryLayout(getHistoryDir())
  })

  ipcMain.handle('history:query', async (_e, params) => {
    const { startDate, endDate, keyword } = params || {}
    const historyDir = getHistoryDir()
    const kw = keyword?.trim().toLowerCase() || ''
    // 原文预筛用 JSON 转义后的关键字，避免引号等字符导致漏命中
    const needle = kw ? JSON.stringify(kw).slice(1, -1) : ''
    const dates = listHistoryDates(historyDir)
      .filter((date) => (!startDate || date >= startDate) && (!endDate || date <= endDate))
      .sort()

    // 并发读取并设上限，避免阻塞主进程
    const results: Array<any | null> = new Array(dates.length)
    let nextIndex = 0
    const worker = async () => {
      while (nextIndex < dates.length) {
        const index = nextIndex++
        const filePath = historyFilePath(historyDir, dates[index])
        try {
          let data: any
          if (kw) {
            // 先按原文粗筛，未命中的文件直接跳过 JSON 解析
            const text = await readFile(filePath, 'utf-8').catch(() => '')
            if (!text.includes(needle) && !text.toLowerCase().includes(needle)) continue
            data = JSON.parse(text)
            data.tasks = (data.tasks || []).filter((t: any) => taskMatchesKeyword(t, kw))
          } else {
            data = await readJsonFileAsync<any>(filePath, null)
          }
          if (data?.tasks?.length > 0) results[index] = data
        } catch (e) {
          console.error('[History] 跳过损坏文件:', e)
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(QUERY_CONCURRENCY, dates.length) }, () => worker()))

    const days = results.filter((d): d is any => d !== null)
    // 日期升序返回，日期内按平台状态与类型排序
    for (const day of days) {
      const orderFields = (t: any) => ({
        status: t.remote?._embedded?.status?.name,
        type: t.remote?._embedded?.type?.name,
        date: day.date,
        seq: t.rawSeq,
      })
      day.tasks.sort((a: any, b: any) => compareTaskOrder(orderFields(a), orderFields(b)))
    }
    return days
  })

  // 批量同步任务到管理平台（工作池限并发，避免大批量同步打爆平台接口）
  ipcMain.handle('history:syncTasks', async (_e, tasks: any[], cookie: string) => {
    const results: any[] = new Array(tasks.length)
    let nextIndex = 0

    /**
     * 依次取任务请求远程详情，结果按原索引写回
     */
    async function worker() {
      while (nextIndex < tasks.length) {
        const index = nextIndex++
        const task = tasks[index]
        const wpId = task.serWorkPackageId || extractWpId(task.rawUrl)
        if (!wpId) {
          results[index] = { taskId: task.serId, workPackageId: null, exists: false, remote: null }
          continue
        }
        try {
          const detail = await api.get(`/api/v3/work_packages/${wpId}`, cookie)
          results[index] = { taskId: task.serId, workPackageId: wpId, exists: true, remote: detail }
        } catch (e) {
          results[index] = {
            taskId: task.serId,
            workPackageId: wpId,
            exists: false,
            remote: null,
            error: (e as Error).message,
          }
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(SYNC_CONCURRENCY, tasks.length) }, () => worker()))
    return results
  })

  ipcMain.handle('history:restoreFromDir', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择备份目录',
      properties: ['openDirectory'],
    })
    if (result.canceled || !result.filePaths?.[0]) return { count: 0, conflictCount: 0 }
    const srcDir = result.filePaths[0]
    const historyDir = getHistoryDir()
    // 源目录可能同时有平铺旧备份与年月分层新备份，递归查找日期文件
    const { sources, conflictCount } = pickRestoreSources(srcDir, listJsonFilesRecursive(srcDir))
    let count = 0
    for (const { date, relPath } of sources) {
      const destPath = historyFilePath(historyDir, date)
      try {
        mkdirSync(dirname(destPath), { recursive: true })
        copyFileSync(join(srcDir, relPath), destPath, constants.COPYFILE_FICLONE)
        count++
      } catch (e) {
        console.error('[History] 恢复文件失败:', e)
        // 跳过单个失败
      }
    }
    return { count, conflictCount }
  })

  ipcMain.handle('history:backupNow', async (_e, dirs?: string[]) => {
    const backupDirs = dirs || getSettings().get('history.backupDirectories', [])
    if (!backupDirs.length) return { success: false, message: '未设置备份目录' }
    const now = new Date().toISOString()
    const ok = performBackupFn(backupDirs, getHistoryDir, getStoreDir)
    return { success: ok > 0, count: ok, total: backupDirs.length, time: now }
  })
}

export { performBackup }
