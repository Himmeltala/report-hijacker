/*
 * @Author: zhengrenfu
 * @Date: 2026-07-13 00:26:38
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-12 09:32:00
 * @FilePath: \electron\preload.ts
 * @Description: 预加载脚本，通过 contextBridge 暴露 IPC 接口
 */
import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { IpcApi } from '@/types/ipc'

// 注册 IPC 事件监听，返回取消订阅函数
function subscribe<T extends unknown[]>(channel: string, callback: (...args: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, ...args: unknown[]) => callback(...(args as T))
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

// 实现受 IpcApi 约束：主进程新增接口时，这里漏实现会在编译期报错
const api: IpcApi = {
  // #region 设置读写
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  getSettingsAll: () => ipcRenderer.invoke('settings:getAll'),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
  getSettingsSchema: () => ipcRenderer.invoke('settings:getSchema'),
  exportSettings: () => ipcRenderer.invoke('settings:export'),
  importSettings: () => ipcRenderer.invoke('settings:import'),
  // #endregion

  // #region 任务详情
  fetchTaskDetail: (params) => ipcRenderer.invoke('api:fetchTaskDetail', params),
  checkComments: (params) => ipcRenderer.invoke('api:checkComments', params),
  aiChat: (params) => ipcRenderer.invoke('ai:chat', params),
  aiUsageSummary: (range) => ipcRenderer.invoke('ai:usageSummary', range),
  // #endregion

  // #region 通知
  fetchNotifications: (params) => ipcRenderer.invoke('api:fetchNotifications', params),
  markNotificationRead: (params) => ipcRenderer.invoke('api:markNotificationRead', params),
  markNotificationsRead: (params) => ipcRenderer.invoke('api:markNotificationsRead', params),
  // #endregion

  // #region 系统通知
  showSysNotification: (params) => ipcRenderer.invoke('sys:showNotification', params),
  sendMailNotification: (params) => ipcRenderer.invoke('mail:send', params),
  sendTestMail: () => ipcRenderer.invoke('mail:test'),
  // #endregion

  // #region 通用数据存储
  storeGet: (key: string) => ipcRenderer.invoke('store:get', key),
  storeSet: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
  storeDelete: (key: string) => ipcRenderer.invoke('store:delete', key),
  storeKeys: () => ipcRenderer.invoke('store:keys'),
  // #endregion

  // #region 文件对话框
  openFile: (params) => ipcRenderer.invoke('dialog:openFile', params),
  saveFile: (params) => ipcRenderer.invoke('dialog:saveFile', params),
  // #endregion

  // #region 文件读写
  writeTextFile: (params) => ipcRenderer.invoke('file:writeTextFile', params),
  writeBinaryFile: (params) => ipcRenderer.invoke('file:writeBinaryFile', params),
  copyImagePng: (params) => ipcRenderer.invoke('clipboard:writeImagePng', params),
  copyText: (params) => ipcRenderer.invoke('clipboard:writeText', params),
  fillExcelTemplate: (params) => ipcRenderer.invoke('file:fillExcelTemplate', params),
  // #endregion

  // #region 历史任务
  listHistoryDates: (range) => ipcRenderer.invoke('history:listDates', range),
  getHistoryDate: (date: string) => ipcRenderer.invoke('history:getDate', date),
  saveHistoryDate: (date: string, data) => ipcRenderer.invoke('history:saveDate', date, data),
  batchSaveHistory: (batch) => ipcRenderer.invoke('history:batchSave', batch),
  deleteHistoryDate: (date: string) => ipcRenderer.invoke('history:deleteDate', date),
  queryHistory: (params) => ipcRenderer.invoke('history:query', params),
  syncHistoryTasks: (tasks, cookie: string) => ipcRenderer.invoke('history:syncTasks', tasks, cookie),
  restoreHistoryFromDir: () => ipcRenderer.invoke('history:restoreFromDir'),
  backupNow: (dirs?: string[]) => ipcRenderer.invoke('history:backupNow', dirs),
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
  applyUpdate: () => ipcRenderer.invoke('update:apply'),
  onUpdateAvailable: (callback) => subscribe('event:updateAvailable', callback),
  onUpdateProgress: (callback) => subscribe('event:updateProgress', callback),
  // #endregion

  // #region 事件监听
  onThemeChanged: (callback: (theme: string) => void) => subscribe('event:themeChanged', callback),
  onProfileSwitched: (callback: (name: string) => void) => subscribe('profile:switched', callback),
  onAutoSyncSettingsChanged: (callback: () => void) => subscribe('event:autoSyncSettingsChanged', callback),
  onBackupCompleted: (callback: () => void) => subscribe('event:backupCompleted', callback),
  // #endregion
}

contextBridge.exposeInMainWorld('electron', api)
