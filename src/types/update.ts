/*
 * @Author: zhengrenfu
 * @Date: 2026-11-04 15:19:08
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-06 10:48:00
 * @FilePath: \src\types\update.ts
 * @Description: 应用更新相关的检查结果、进度与状态类型
 */

// #region 更新检查

/** 检查方式：共享盘目录或更新接口 */
export type UpdateSource = 'share' | 'http'

/** 更新频率：定时检查、启动后检查、关闭自动更新 */
export type UpdateFrequency = 'interval' | 'startup' | 'off'

/** 一次更新检查的结果，error 有值时表示检查失败 */
export interface UpdateCheckResult {
  hasUpdate: boolean
  source: UpdateSource
  // 新版本号，共享盘按文件名解析，接口取返回的 version
  version?: string
  fileName?: string
  // 共享盘方式的安装包完整路径
  filePath?: string
  // 接口方式的安装包下载地址
  url?: string
  md5?: string
  size?: number
  // 接口返回的更新说明
  notes?: string
  error?: string
  checkedAt: string
}

/** 安装包复制或下载进度 */
export interface UpdateProgress {
  phase: 'copy' | 'download'
  received: number
  total: number
  percent: number
}

/** 应用更新时传给主进程的安装包信息 */
export interface UpdateApplyParams {
  source: UpdateSource
  version?: string
  fileName?: string
  filePath?: string
  url?: string
  md5?: string
  size?: number
}

/** 应用更新的结果，started 为 true 表示已安排在本程序退出后启动安装程序 */
export interface UpdateApplyResult {
  started: boolean
  error?: string
}

/** 设置面板展示的更新状态 */
export interface UpdateStatus {
  currentVersion: string
  installedMd5: string
  installedVersion: string
  lastCheckAt: string | null
  mode: UpdateSource
  frequency: UpdateFrequency
  packaged: boolean
  platform: string
}

// #endregion
