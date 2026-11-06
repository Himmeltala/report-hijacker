/*
 * @Author: zhengrenfu
 * @Date: 2026-07-14 01:23:28
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-06 12:01:00
 * @FilePath: \..\\src\\types\\ipc.ts
 * @Description: 描述
 */

import type { TaskDetailResult } from '@/types/task'
import type { ActivitiesResponse, NotificationsResponse } from '@/types/api'
import type { ReadonlyRawWorkPackage } from '@/types/remote'
import type {
  UpdateApplyParams,
  UpdateApplyResult,
  UpdateCheckResult,
  UpdateProgress,
  UpdateStatus,
} from '@/types/update'

export interface HistoryTaskItem {
  serId: string
  serDate: string
  rawSeq: number
  rawProjectName: string
  rawTitle: string
  rawHandler: string
  rawUrl: string
  rawScore: string
  rawEstimatedHours: string
  rawRemark: string
  rawText: string
  serSyncStatus: 'none' | 'synced'
  serWorkPackageId: string | null
  // 远程原始数据，只读，平台字段原封不动
  remote: ReadonlyRawWorkPackage | null
  serSyncedAt: string | null
  // AI 审查结论，未执行 AI 审查时为 null
  serAiConclusion?: string | null
  // 任务优先级：高、中、低
  serPriority: 'high' | 'medium' | 'low' | null
  // 限时任务：今日、临时
  serTimeLimit: 'today' | 'temp' | null
  // 是否为延期任务（本地标记）
  serPostponed: boolean
  serPostponedReason: string
  serCreatedAt: string
  serUpdatedAt: string
}

export interface HistoryDay {
  date: string
  tasks: HistoryTaskItem[]
  createdAt: string
  updatedAt: string
}

export interface FetchTaskDetailParams {
  rawUrl: string
  cookie: string
}

export interface CheckCommentsParams {
  taskId: string
  cookie: string
}

// 对话消息，支持多轮与工具调用回填（OpenAI 兼容格式）
export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  // 模型要求调用的工具
  tool_calls?: AiChatToolCall[]
  // 工具结果对应的调用 id
  tool_call_id?: string
}

export interface AiChatToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    // 参数为 JSON 字符串，由调用方解析
    arguments: string
  }
}

export interface AiChatTool {
  type: 'function'
  function: {
    name: string
    description?: string
    // JSON Schema 格式的参数定义
    parameters?: Record<string, unknown>
  }
}

export interface AiChatParams {
  // 单轮调用的最终提示词，与 messages 二选一
  prompt?: string
  // 多轮调用的完整消息列表，优先于 prompt
  messages?: AiChatMessage[]
  // 可用工具定义，不传时按纯文本对话
  tools?: AiChatTool[]
}

export interface AiChatResult {
  text: string
  reasoning?: string
  // 模型本轮要求调用的工具，为空表示对话结束
  toolCalls?: AiChatToolCall[]
}

export interface OpenFileParams {
  filters?: { name: string; extensions: string[] }[]
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>
}

export interface SaveFileParams {
  defaultName: string
  filters?: { name: string; extensions: string[] }[]
}

export interface FillExcelTemplateParams {
  tasks: any[]
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

export interface IpcApi {
  getSetting: (key: string) => Promise<any>
  getSettingsAll: () => Promise<Record<string, any>>
  setSetting: (key: string, value: any) => Promise<void>
  getSettingsSchema: () => Promise<any[]>
  exportSettings: () => Promise<{ success: boolean; filePath?: string }>
  importSettings: () => Promise<{ success: boolean } | null>
  onThemeChanged: (callback: (theme: string) => void) => () => void
  onMenuEvent: (callback: (data: { action: string }) => void) => () => void

  storeGet: (key: string) => Promise<any>
  storeSet: (key: string, value: any) => Promise<void>
  storeDelete: (key: string) => Promise<void>
  storeKeys: () => Promise<string[]>

  fetchTaskDetail: (params: FetchTaskDetailParams) => Promise<TaskDetailResult>

  checkComments: (params: CheckCommentsParams) => Promise<ActivitiesResponse>

  // AI 通用对话（连接配置统一，传最终提示词）
  aiChat: (params: AiChatParams) => Promise<AiChatResult>

  fetchNotifications: (params: FetchNotificationsParams) => Promise<NotificationsResponse>
  // 主进程返回 { success, data } 结构
  markNotificationRead: (params: MarkNotificationReadParams) => Promise<{ success: boolean; data?: any }>
  markNotificationsRead: (params: MarkNotificationsReadParams) => Promise<{ success: boolean; data?: any }>

  showSysNotification: (params: {
    title: string
    body: string
    silent?: boolean
    timeoutType?: 'default' | 'never'
  }) => Promise<{ success: boolean; reason?: string }>

  openFile: (params: OpenFileParams) => Promise<string | null>
  saveFile: (params: SaveFileParams) => Promise<string | null>

  writeTextFile: (params: WriteTextFileParams) => Promise<void>
  writeBinaryFile: (params: WriteBinaryFileParams) => Promise<void>
  copyImagePng: (params: CopyImagePngParams) => Promise<void>
  copyText: (params: CopyTextParams) => Promise<void>
  fillExcelTemplate: (params: FillExcelTemplateParams) => Promise<FillExcelTemplateResult>

  listHistoryDates: (range?: { startDate?: string; endDate?: string }) => Promise<string[]>
  getHistoryDate: (date: string) => Promise<HistoryDay | null>
  saveHistoryDate: (date: string, data: any) => Promise<void>
  batchSaveHistory: (batch: Array<{ date: string; data: HistoryDay }>) => Promise<void>
  deleteHistoryDate: (date: string) => Promise<void>
  queryHistory: (params: { startDate?: string; endDate?: string; keyword?: string }) => Promise<HistoryDay[]>
  syncHistoryTasks: (
    tasks: any[],
    cookie: string,
  ) => Promise<
    Array<{
      taskId: string
      workPackageId: string | null
      exists: boolean
      // 远程原始数据（只读）
      remote: ReadonlyRawWorkPackage | null
      error?: string
    }>
  >

  restoreHistoryFromDir: () => Promise<{
    // 成功恢复的历史文件数
    count: number
  }>
  backupNow: (
    dirs?: string[],
  ) => Promise<{ success: boolean; message?: string; count?: number; total?: number; time?: string }>

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
  applyUpdate: (params: UpdateApplyParams) => Promise<UpdateApplyResult>
  onUpdateAvailable: (callback: (data: UpdateCheckResult) => void) => () => void
  onUpdateProgress: (callback: (data: UpdateProgress) => void) => () => void
  onAutoSyncSettingsChanged: (callback: () => void) => () => void
  onBackupCompleted: (callback: () => void) => () => void
}

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    electron: IpcApi
  }
}
