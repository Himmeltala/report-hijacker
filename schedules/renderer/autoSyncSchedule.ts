/*
 * @Author: Himmeltala
 * @Date: 2026-11-05 10:11:32
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-05 10:11:32
 * @FilePath: \schedules\renderer\autoSyncSchedule.ts
 * @Description: 渲染进程历史任务自动同步定时任务
 */

export interface AutoSyncScheduleDeps {
  isEligible: () => boolean
  isEnabled: () => Promise<boolean> | boolean
  getIntervalMs: () => Promise<number> | number
  getLastRunAt: () => Promise<string | null>
  run: () => Promise<void> | void
}

export interface AutoSyncSchedule {
  restart: (skipImmediate?: boolean) => Promise<void>
  stop: () => void
}

const MIN_INTERVAL_MS = 60_000
const IMMEDIATE_DELAY_MS = 1_000

// 创建自动同步定时器，页面挂载时启动，卸载时停止
export function createAutoSyncSchedule(deps: AutoSyncScheduleDeps): AutoSyncSchedule {
  let intervalTimer: ReturnType<typeof setInterval> | null = null
  let initTimer: ReturnType<typeof setTimeout> | null = null

  function stop(): void {
    if (intervalTimer) {
      clearInterval(intervalTimer)
      intervalTimer = null
    }
    if (initTimer) {
      clearTimeout(initTimer)
      initTimer = null
    }
  }

  async function restart(skipImmediate = false): Promise<void> {
    stop()
    if (!deps.isEligible()) return
    if (!(await deps.isEnabled())) return

    const intervalMs = Math.max(MIN_INTERVAL_MS, await deps.getIntervalMs())
    if (!skipImmediate) {
      // 页面加载时按上次同步时间判断，未到期只等剩余时长
      const lastTime = await deps.getLastRunAt()
      const elapsed = lastTime ? Date.now() - new Date(lastTime).getTime() : Infinity
      const remaining = Math.max(0, intervalMs - elapsed)
      initTimer = setTimeout(() => deps.run(), remaining <= 1_000 ? IMMEDIATE_DELAY_MS : remaining)
    }
    intervalTimer = setInterval(() => deps.run(), intervalMs)
  }

  return { restart, stop }
}
