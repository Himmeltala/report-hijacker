/*
 * @Author: zhengrenfu
 * @Date: 2026-11-04 15:19:08
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-06 23:15:00
 * @FilePath: \src\types\update.ts
 * @Description: 应用更新相关的检查结果、进度与状态类型
 */

// #region 更新检查

/** 更新频率：定时检查、启动后检查、关闭自动更新 */
export type UpdateFrequency = 'interval' | 'startup' | 'off'

/** 一次更新检查的结果，error 有值时表示检查失败 */
export interface UpdateCheckResult {
  hasUpdate: boolean
  // 新版本号，取自更新源的 latest.yml
  version?: string
  error?: string
  checkedAt: string
}

/** 更新包下载进度 */
export interface UpdateProgress {
  phase: 'download'
  received: number
  total: number
  percent: number
}

/** 应用更新的结果，started 为 true 表示已下载完成并启动安装程序 */
export interface UpdateApplyResult {
  started: boolean
  error?: string
}

/** 设置面板展示的更新状态 */
export interface UpdateStatus {
  currentVersion: string
  lastCheckAt: string | null
  frequency: UpdateFrequency
  packaged: boolean
  platform: string
}

// #endregion
