/*
 * @Author: Himmeltala
 * @Date: 2026-11-05 10:11:32
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-05 10:40:00
 * @FilePath: \schedules\main\backupSchedule.ts
 * @Description: 主进程备份定时任务
 */

import type { BrowserWindow } from 'electron'
import type { AppSettings } from '@electron/services/settingsService'
import { performBackup } from '@electron/services/historyService'
import { sendToWindow } from '@electron/utils'

// 备份间隔下限（分钟），防止非法配置导致高频备份
const MIN_BACKUP_INTERVAL = 10

export interface BackupScheduleDeps {
  getSettings: () => AppSettings
  getHistoryDir: () => string
  getStoreDir: () => string
  getWindow: () => BrowserWindow | null
}

// 按设置重建备份定时器，设置变更与切换档案后调用
export function setupBackupSchedule(deps: BackupScheduleDeps): { restart: () => void } {
  let timer: ReturnType<typeof setInterval> | null = null

  function restart(): void {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    const settings = deps.getSettings()
    if (!settings.get('history.backupEnabled', false)) return
    const intervalMin = Math.max(
      MIN_BACKUP_INTERVAL,
      Number(settings.get('history.backupInterval', 60)) || MIN_BACKUP_INTERVAL,
    )
    const dirs: string[] = settings.get('history.backupDirectories', [])
    if (!dirs.length) return
    timer = setInterval(
      () => {
        const ok = performBackup(dirs, deps.getHistoryDir, deps.getStoreDir)
        // 备份成功后通知渲染进程刷新上次备份时间
        if (ok > 0) sendToWindow(deps.getWindow, 'event:backupCompleted')
      },
      intervalMin * 60 * 1000,
    )
  }

  return { restart }
}
