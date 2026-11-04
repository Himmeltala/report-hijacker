/*
 * @Author: zhengrenfu
 * @Date: 2026-07-16 21:36:19
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-07-16 12:14:04
 * @FilePath: \src\types\log.ts
 * @Description: 日志类型定义
 */

// #region 日志类型

export interface LogEntry {
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
  time: string
}

// #endregion
