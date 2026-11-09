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

/**
 * 取统计区间的自然天数，用于折算日均
 * @param {number | string} calendar 年（number）或 YYYY-MM（string）
 * @returns {number} 年视图返回该年天数（闰年 366），月视图返回当月天数
 */
export function getPeriodDays(calendar: number | string): number {
  if (typeof calendar === 'number') return new Date(calendar, 1, 29).getMonth() === 1 ? 366 : 365
  return new Date(Number(calendar.slice(0, 4)), Number(calendar.slice(5, 7)), 0).getDate()
}

/**
 * 统计区日期展示文本
 * @param {string | null} date 日期，格式 YYYY-MM-DD，无数据时传 null
 * @param {boolean} withMonth 是否带月份，年视图为 true
 * @returns {string} 年视图形如 9月9日，月视图形如 9日，无数据返回短横线
 */
export function formatStatDay(date: string | null, withMonth: boolean): string {
  if (!date) return '—'
  const [, month, day] = date.split('-').map(Number)
  return withMonth ? `${month}月${day}日` : `${day}日`
}

// #endregion
