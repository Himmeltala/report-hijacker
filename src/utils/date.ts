/*
 * @Author: zhengrenfu
 * @Date: 2026-09-14 10:00:00
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-09-14 10:00:00
 * @FilePath: \src\utils\date.ts
 * @Description: 日期格式化与偏移工具函数
 */

// #region 日期工具

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date} d 日期对象
 * @returns {string} 本地时区下的日期字符串
 */
export function formatYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * @param {Date} d 基准日期
 * @param {number} n 偏移天数，负数表示往前
 * @returns {Date} 偏移后的新日期对象
 */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// #endregion
