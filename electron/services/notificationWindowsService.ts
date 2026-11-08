/*
 * @Author: zhengrenfu
 * @Date: 2026-08-06
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-08 18:02:00
 * @FilePath: \electron\services\notificationWindowsService.ts
 * @Description: 系统通知服务：渲染进程请求弹出 Windows 系统通知
 */

import { ipcMain, Notification } from 'electron'
import type { BrowserWindow } from 'electron'

// #region 类型定义

export interface SysNotificationParams {
  title: string
  body: string
  silent?: boolean
  timeoutType?: 'default' | 'never'
}

// #endregion

// #region IPC 注册

/**
 * 注册系统通知 IPC
 * @param {Function} getWindow 获取主窗口的函数，点击通知时聚焦窗口
 */
export function setupSysNotificationIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('sys:showNotification', (_e, params: SysNotificationParams) => {
    if (!params || !params.title) {
      console.warn('[系统通知] 缺少通知参数')
      return { success: false, reason: '缺少参数' }
    }
    if (!Notification.isSupported()) {
      console.warn('[系统通知] 当前系统不支持通知')
      return { success: false, reason: 'unsupported' }
    }
    const n = new Notification({
      title: params.title,
      body: params.body || '',
      silent: !!params.silent,
      timeoutType: params.timeoutType === 'never' ? 'never' : 'default',
    })
    n.on('click', () => {
      const win = getWindow()
      if (win) {
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      }
    })
    n.show()
    return { success: true }
  })
}

// #endregion
