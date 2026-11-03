/*
 * @Author: zhengrenfu
 * @Date: 2026-08-08 00:05:28
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-08 12:14:04
 * @FilePath: \src\utils\hours.ts
 * @Description: 时长字符串解析为小时数的共享纯函数，供校验引擎与视图层共用
 */

// #region 时长解析

/**
 * 解析时长字符串为小时数
 * ISO 8601 时长：PT6H / PT30M / P1DT2H30M，天按 24 小时折算
 * 纯数字字符串：平台自定义字段直接以小时为单位
 * 空值或无法解析返回 0
 * @param {string} value 时长字符串
 * @returns {number} 小时数
 */
export function parseHoursValue(value: string): number {
  if (!value) return 0
  const s = value.trim()
  // 纯数字：平台自定义字段以小时为单位的数字值
  if (/^\d+(?:\.\d+)?$/.test(s)) return parseFloat(s)
  // ISO 8601 时长：P[nD][T[nH][nM]]
  const match = s.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return 0
  const days = parseInt(match[1] || '0', 10)
  const hours = parseInt(match[2] || '0', 10)
  const minutes = parseInt(match[3] || '0', 10)
  return days * 24 + hours + minutes / 60
}

// #endregion
