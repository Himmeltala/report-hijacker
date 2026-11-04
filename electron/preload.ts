/*
 * @Author: zhengrenfu
 * @Date: 2026-07-13 00:26:38
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 14:21:53
 * @FilePath: \electron\preload.ts
 * @Description: 预加载脚本，通过 contextBridge 暴露 IPC 接口
 */
import { contextBridge, ipcRenderer } from 'electron'

/** 注册 IPC 事件监听，返回取消订阅函数 */
function subscribe(channel: string, callback: (...args: any[]) => void): () => void {
  const handler = (_e: any, ...args: any[]) => callback(...args)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld('electron', {
  // #region 设置读写
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  getSettingsAll: () => ipcRenderer.invoke('settings:getAll'),
  setSetting: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
  getSettingsSchema: () => ipcRenderer.invoke('settings:getSchema'),
  exportSettings: () => ipcRenderer.invoke('settings:export'),
  importSettings: () => ipcRenderer.invoke('settings:import'),
  // #endregion

  // #region 任务详情
  fetchTaskDetail: (params: any) => ipcRenderer.invoke('api:fetchTaskDetail', params),
  checkComments: (params: any) => ipcRenderer.invoke('api:checkComments', params),
  aiChat: (params: any) => ipcRenderer.invoke('ai:chat', params),
  // #endregion

  // #region 通知
  fetchNotifications: (params: any) => ipcRenderer.invoke('api:fetchNotifications', params),
  markNotificationRead: (params: any) => ipcRenderer.invoke('api:markNotificationRead', params),
  markNotificationsRead: (params: any) => ipcRenderer.invoke('api:markNotificationsRead', params),
  // #endregion

  // #region 系统通知
  showSysNotification: (params: any) => ipcRenderer.invoke('sys:showNotification', params),
  // #endregion

  // #region 通用数据存储
  storeGet: (key: string) => ipcRenderer.invoke('store:get', key),
  storeSet: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),
  storeDelete: (key: string) => ipcRenderer.invoke('store:delete', key),
  storeKeys: () => ipcRenderer.invoke('store:keys'),
  // #endregion

  // #region 文件对话框
  openFile: (params: any) => ipcRenderer.invoke('dialog:openFile', params),
  saveFile: (params: any) => ipcRenderer.invoke('dialog:saveFile', params),
  // #endregion

  // #region 文件读写
  writeTextFile: (params: any) => ipcRenderer.invoke('file:writeTextFile', params),
  fillExcelTemplate: (params: any) => ipcRenderer.invoke('file:fillExcelTemplate', params),
  // #endregion

  // #region 历史任务
  listHistoryDates: (range?: { startDate?: string; endDate?: string }) =>
    ipcRenderer.invoke('history:listDates', range),
  getHistoryDate: (date: string) => ipcRenderer.invoke('history:getDate', date),
  saveHistoryDate: (date: string, data: any) => ipcRenderer.invoke('history:saveDate', date, data),
  batchSaveHistory: (batch: Array<{ date: string; data: any }>) => ipcRenderer.invoke('history:batchSave', batch),
  deleteHistoryDate: (date: string) => ipcRenderer.invoke('history:deleteDate', date),
  queryHistory: (params: any) => ipcRenderer.invoke('history:query', params),
  syncHistoryTasks: (tasks: any[], cookie: string) => ipcRenderer.invoke('history:syncTasks', tasks, cookie),
  restoreHistoryFromDir: () => ipcRenderer.invoke('history:restoreFromDir'),
  backupNow: (dirs?: string[]) => ipcRenderer.invoke('history:backupNow', dirs),
  migrateHistoryLayout: () => ipcRenderer.invoke('history:migrateLayout'),
  // #endregion

  // #region 用户档案管理
  profileCurrent: () => ipcRenderer.invoke('profile:current'),
  profileList: () => ipcRenderer.invoke('profile:list'),
  profileSwitch: (name: string) => ipcRenderer.invoke('profile:switch', name),
  profileAdd: (name: string) => ipcRenderer.invoke('profile:add', name),
  profileRename: (oldName: string, newName: string) => ipcRenderer.invoke('profile:rename', oldName, newName),
  profileDelete: (name: string) => ipcRenderer.invoke('profile:delete', name),
  // #endregion

  // #region 应用更新
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  getUpdateStatus: () => ipcRenderer.invoke('update:status'),
  applyUpdate: (params: any) => ipcRenderer.invoke('update:apply', params),
  onUpdateAvailable: (callback: (data: any) => void) => subscribe('event:updateAvailable', callback),
  onUpdateProgress: (callback: (data: any) => void) => subscribe('event:updateProgress', callback),
  onUpdateFailed: (callback: (data: { error: string }) => void) => subscribe('event:updateFailed', callback),
  // #endregion

  // #region 事件监听
  onThemeChanged: (callback: (theme: string) => void) => subscribe('event:themeChanged', callback),
  onMenuEvent: (callback: (data: { action: string }) => void) => subscribe('menu:event', callback),
  onProfileSwitched: (callback: (name: string) => void) => subscribe('profile:switched', callback),
  onAutoSyncSettingsChanged: (callback: () => void) => subscribe('event:autoSyncSettingsChanged', callback),
  onBackupCompleted: (callback: () => void) => subscribe('event:backupCompleted', callback),
  // #endregion
})
