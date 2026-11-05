/*
 * @Author: Himmeltala
 * @Date: 2026-11-05 10:11:32
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-05 10:11:32
 * @FilePath: \schedules\main\updateSchedule.ts
 * @Description: 主进程更新检查定时任务
 */

import type { UpdateDeps } from '@electron/services/updateService'
import { readUpdateFrequency, runAutoCheck } from '@electron/services/updateService'

// 自动检查间隔下限（小时），防止非法配置导致高频检查
const MIN_INTERVAL_HOURS = 1

// 启动检查延迟，避开启动阶段的网络与磁盘争用
const STARTUP_CHECK_DELAY_MS = 30_000

// 按设置重建自动检查定时器，设置变更与切换档案后调用
export function setupUpdateSchedule(deps: UpdateDeps): { restart: () => void } {
  let intervalTimer: ReturnType<typeof setInterval> | null = null
  let startupTimer: ReturnType<typeof setTimeout> | null = null

  function restart(): void {
    if (intervalTimer) {
      clearInterval(intervalTimer)
      intervalTimer = null
    }
    if (startupTimer) {
      clearTimeout(startupTimer)
      startupTimer = null
    }
    const settings = deps.getSettings()
    const frequency = readUpdateFrequency(settings)
    if (frequency === 'off') return
    if (frequency === 'startup') {
      startupTimer = setTimeout(() => runAutoCheck(deps), STARTUP_CHECK_DELAY_MS)
      return
    }
    const hours = Math.max(MIN_INTERVAL_HOURS, Number(settings.get('update.intervalHours', 6)) || 6)
    intervalTimer = setInterval(() => runAutoCheck(deps), hours * 60 * 60 * 1000)
  }

  return { restart }
}
