/*
 * @Author: zhengrenfu
 * @Date: 2026-08-06 10:13:41
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-08 18:02:00
 * @FilePath: \src\utils\notificationWindows.ts
 * @Description: 系统通知公共函数：按设置条件弹出 Windows 系统通知
 */

import { useLogStore } from '@/stores/log.store'
import { getErrorMessage } from '@/utils/error'

// #region 系统通知

/**
 * 按设置条件弹出系统通知
 * @param {string} sceneKey 场景开关设置键，如 notification.onSyncCompleted
 * @param {string} title 通知标题
 * @param {string} body 通知正文
 */
export async function maybeShowSysNotification(sceneKey: string, title: string, body: string): Promise<void> {
  const logStore = useLogStore()
  try {
    const enabled = await window.electron.getSetting<boolean>('notification.enabled')
    if (!enabled) return
    if (!(await window.electron.getSetting<boolean>(sceneKey))) return
    if (await window.electron.getSetting<boolean>('notification.onlyWhenBackground')) {
      if (document.hasFocus()) return
    }
    const silent = !!(await window.electron.getSetting<boolean>('notification.silent'))
    const timeoutType =
      (await window.electron.getSetting<string>('notification.timeoutType')) === 'never' ? 'never' : 'default'
    await window.electron.showSysNotification({ title, body, silent, timeoutType })
  } catch (e) {
    logStore.addLog('warning', '系统通知失败: ' + getErrorMessage(e))
  }
}

// #endregion
