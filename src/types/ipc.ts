/*
 * @Author: zhengrenfu
 * @Date: 2026-07-14 01:23:28
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-12 09:32:00
 * @FilePath: \..\\src\\types\\ipc.ts
 * @Description: IPC 接口契约，渲染层与主进程共用的参数、结果类型
 */

import type { AiChatParams, AiChatResult } from '@/types/ai'
import type { AiUsageRange, AiUsageSummary } from '@/types/aiUsage'
import type { HistoryDay } from '@/types/history'
import type { ExcelTaskRow, RawTaskFields, TaskDetailResult } from '@/types/task'
import type { ActivitiesResponse, NotificationsResponse } from '@/types/api'
import type { ReadonlyRawWorkPackage } from '@/types/remote'
import type { SettingsSchema } from '@/types/settings'
import type { UpdateApplyResult, UpdateCheckResult, UpdateProgress, UpdateStatus } from '@/types/update'

// AI 对话类型按领域拆分到 ai.ts，这里保留 re-export 兼容既有导入
export type { AiChatMessage, AiChatParams, AiChatResult, AiChatTool, AiChatToolCall } from '@/types/ai'
// 历史任务模型按领域拆分到 history.ts，这里保留 re-export 兼容既有导入
export type {
  DatedTask,
  HistoryDay,
  HistoryTaskItem,
  TaskPriority,
  TaskSyncStatus,
  TaskTimeLimit,
} from '@/types/history'

// #region 通用参数与结果

/** 设置项键值对集合，键名为点号分隔的完整键名 */
export type FlatSettings = Record<string, unknown>

/** 历史查询的日期区间，省略表示不限 */
export interface HistoryDateRange {
  startDate?: string
  endDate?: string
}

/** 历史查询参数，keyword 为空表示不按关键字过滤 */
export interface QueryHistoryParams extends HistoryDateRange {
  keyword?: string
}

/** 文件对话框的类型过滤器 */
export interface FileFilter {
  name: string
  extensions: string[]
}

/** 文件对话框的可选行为 */
export type FileDialogProperty = 'openFile' | 'openDirectory' | 'multiSelections'

/** 通知写操作结果，data 为平台返回的原始响应 */
export interface NotificationMutationResult {
  success: boolean
  data?: unknown
}

/** 系统通知参数 */
export interface SysNotificationParams {
  title: string
  body: string
  silent?: boolean
  timeoutType?: 'default' | 'never'
}

/** 系统通知结果，reason 说明未展示的原因 */
export interface SysNotificationResult {
  success: boolean
  reason?: string
}

/** 邮件通知参数 */
export interface MailSendParams {
  subject: string
  body: string
}

/** 邮件通知结果，reason 说明发送失败的原因（已截断，便于直接展示） */
export interface MailSendResult {
  success: boolean
  reason?: string
}

/** 设置导出结果 */
export interface SettingsExportResult {
  success: boolean
  filePath?: string
}

/** 设置导入结果 */
export interface SettingsImportResult {
  success: boolean
}

/** 历史同步入参，需提供工作包 ID 或可解析出 ID 的任务链接 */
export type SyncableTask = Pick<RawTaskFields, 'rawUrl'> & {
  serId: string
  serWorkPackageId?: string | null
}

/** 单条历史同步结果 */
export interface SyncHistoryTaskResult {
  taskId: string
  workPackageId: string | null
  exists: boolean
  // 远程原始数据（只读）
  remote: ReadonlyRawWorkPackage | null
  error?: string
}

/** 从备份目录恢复历史的结果 */
export interface RestoreHistoryResult {
  // 成功恢复的历史文件数
  count: number
}

/** 立即备份的结果 */
export interface BackupResult {
  success: boolean
  message?: string
  count?: number
  total?: number
  time?: string
}

// #endregion

// #region 各接口入参

export interface FetchTaskDetailParams {
  rawUrl: string
  cookie: string
}

export interface CheckCommentsParams {
  taskId: string
  cookie: string
}

export interface OpenFileParams {
  filters?: FileFilter[]
  properties?: FileDialogProperty[]
}

export interface SaveFileParams {
  defaultName: string
  filters?: FileFilter[]
}

export interface FillExcelTemplateParams {
  tasks: ExcelTaskRow[]
  templatePath?: string
  targetPath: string
  handlerName: string
  cookie: string
}

export interface WriteTextFileParams {
  filePath: string
  content: string
}

export interface WriteBinaryFileParams {
  filePath: string
  dataBase64: string
}

export interface CopyImagePngParams {
  dataBase64: string
}

export interface CopyTextParams {
  text: string
}

export interface FetchNotificationsParams {
  cookie: string
  onlyUnread?: boolean
  pageSize?: number
  offset?: number
}

export interface MarkNotificationReadParams {
  id: number
  cookie: string
}

export interface MarkNotificationsReadParams {
  ids: number[]
  cookie: string
}

export interface FillExcelTemplateResult {
  success: boolean
  filePath?: string
  error?: string
}

// #endregion

// #region IPC 接口

export interface IpcApi {
  getSetting: <T = unknown>(key: string) => Promise<T>
  getSettingsAll: () => Promise<FlatSettings>
  setSetting: (key: string, value: unknown) => Promise<void>
  getSettingsSchema: () => Promise<SettingsSchema>
  exportSettings: () => Promise<SettingsExportResult>
  importSettings: () => Promise<SettingsImportResult | null>
  onThemeChanged: (callback: (theme: string) => void) => () => void

  storeGet: (key: string) => Promise<any>
  storeSet: (key: string, value: any) => Promise<void>
  storeDelete: (key: string) => Promise<void>
  storeKeys: () => Promise<string[]>

  fetchTaskDetail: (params: FetchTaskDetailParams) => Promise<TaskDetailResult>

  checkComments: (params: CheckCommentsParams) => Promise<ActivitiesResponse>

  // AI 通用对话（连接配置统一，传最终提示词）
  aiChat: (params: AiChatParams) => Promise<AiChatResult>

  // AI token 用量汇总，range 为统计天数，0 表示全部
  aiUsageSummary: (range: AiUsageRange) => Promise<AiUsageSummary>

  fetchNotifications: (params: FetchNotificationsParams) => Promise<NotificationsResponse>
  // 主进程返回 { success, data } 结构
  markNotificationRead: (params: MarkNotificationReadParams) => Promise<NotificationMutationResult>
  markNotificationsRead: (params: MarkNotificationsReadParams) => Promise<NotificationMutationResult>

  showSysNotification: (params: SysNotificationParams) => Promise<SysNotificationResult>

  // 邮件通知：按设置里的 SMTP 配置发送到指定邮箱
  sendMailNotification: (params: MailSendParams) => Promise<MailSendResult>
  // 用当前邮件配置发送一封测试邮件
  sendTestMail: () => Promise<MailSendResult>

  openFile: (params: OpenFileParams) => Promise<string | null>
  saveFile: (params: SaveFileParams) => Promise<string | null>

  writeTextFile: (params: WriteTextFileParams) => Promise<void>
  writeBinaryFile: (params: WriteBinaryFileParams) => Promise<void>
  copyImagePng: (params: CopyImagePngParams) => Promise<void>
  copyText: (params: CopyTextParams) => Promise<void>
  fillExcelTemplate: (params: FillExcelTemplateParams) => Promise<FillExcelTemplateResult>

  listHistoryDates: (range?: HistoryDateRange) => Promise<string[]>
  getHistoryDate: (date: string) => Promise<HistoryDay | null>
  saveHistoryDate: (date: string, data: HistoryDay) => Promise<void>
  batchSaveHistory: (batch: Array<{ date: string; data: HistoryDay }>) => Promise<void>
  deleteHistoryDate: (date: string) => Promise<void>
  queryHistory: (params: QueryHistoryParams) => Promise<HistoryDay[]>
  syncHistoryTasks: (tasks: SyncableTask[], cookie: string) => Promise<SyncHistoryTaskResult[]>

  restoreHistoryFromDir: () => Promise<RestoreHistoryResult>
  backupNow: (dirs?: string[]) => Promise<BackupResult>

  profileCurrent: () => Promise<string>
  profileList: () => Promise<string[]>
  profileSwitch: (name: string) => Promise<void>
  profileAdd: (name: string) => Promise<string[]>
  profileRename: (oldName: string, newName: string) => Promise<string[]>
  profileDelete: (name: string) => Promise<string[]>
  onProfileSwitched: (callback: (name: string) => void) => () => void

  // 应用更新
  checkUpdate: () => Promise<UpdateCheckResult>
  getUpdateStatus: () => Promise<UpdateStatus>
  applyUpdate: () => Promise<UpdateApplyResult>
  onUpdateAvailable: (callback: (data: UpdateCheckResult) => void) => () => void
  onUpdateProgress: (callback: (data: UpdateProgress) => void) => () => void
  onAutoSyncSettingsChanged: (callback: () => void) => () => void
  onBackupCompleted: (callback: () => void) => () => void
}

// #endregion

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    electron: IpcApi
  }
}
