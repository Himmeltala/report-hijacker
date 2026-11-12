/*
 * @Author: Himmeltala
 * @Date: 2026-11-12 09:08:04
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-12 09:32:00
 * @FilePath: \electron\services\aiUsageService.ts
 * @Description: AI token 用量记录：按天累计请求次数与 token 数，并提供用量查询 IPC
 */

import { ipcMain } from 'electron'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { readStoreValue, storeFilePath, writeStoreValue } from '@electron/services/storeService'
import type { AiTokenUsage } from '@/types/ai'
import type { AiUsageDay, AiUsagePoint, AiUsageRange, AiUsageSummary } from '@/types/aiUsage'

// #region 常量

// 用量记录的 store 键名，数据按 aiUsage/YYYY/MM/YYYY-MM-DD.json 分层存放
export const AI_USAGE_STORE_KEY = 'aiUsage'

// 用量日期文件名的合法格式，防止目录里的杂项文件被当成日期
const USAGE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// 今天视图按小时统计，一天 24 个点
const HOURS_PER_DAY = 24

// 可选的统计范围，单位为天
const SUPPORTED_RANGES: AiUsageRange[] = [0, 1, 7, 14, 30]

// 默认统计范围
const DEFAULT_RANGE: AiUsageRange = 7

// #endregion

// #region 日期工具

/**
 * 按本地时区格式化日期为 YYYY-MM-DD
 * @param {Date} d 日期对象
 * @returns {string} 日期字符串
 */
function formatLocalDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/**
 * 由基准日期前后偏移若干天
 * @param {Date} d 基准日期
 * @param {number} n 偏移天数，负数表示往前
 * @returns {Date} 偏移后的日期
 */
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// #endregion

// #region 记录读写

/**
 * 单日用量记录的 store 键，形如 aiUsage/2026/11/2026-11-12
 * @param {string} date 日期（YYYY-MM-DD）
 * @returns {string} store 键
 */
function usageStoreKey(date: string): string {
  return `${AI_USAGE_STORE_KEY}/${date.slice(0, 4)}/${date.slice(5, 7)}/${date}`
}

/**
 * 生成当天的空用量记录，小时槽一次性建满，前端可直接按索引取数
 * @param {string} date 日期（YYYY-MM-DD）
 * @returns {AiUsageDay} 空记录
 */
function createEmptyDay(date: string): AiUsageDay {
  return {
    date,
    requests: 0,
    promptTokens: 0,
    completionTokens: 0,
    hours: Array.from({ length: HOURS_PER_DAY }, () => ({ requests: 0, promptTokens: 0, completionTokens: 0 })),
  }
}

/**
 * 读取某天的用量记录，文件缺失或结构不对时返回空记录
 * @param {string} storeDir 存储目录
 * @param {string} date 日期（YYYY-MM-DD）
 * @returns {AiUsageDay} 当日用量
 */
function readUsageDay(storeDir: string, date: string): AiUsageDay {
  const data = readStoreValue<AiUsageDay | null>(storeDir, usageStoreKey(date), null)
  if (!data || !Array.isArray(data.hours)) return createEmptyDay(date)
  return { ...createEmptyDay(date), ...data }
}

/**
 * 将一次请求的 token 用量累加到当天记录，按小时归档，同一天多次请求累加
 * @param {string} storeDir 存储目录
 * @param {Date} now 请求发生时间
 * @param {AiTokenUsage} usage 本次请求的 token 用量
 */
export function recordAiUsage(storeDir: string, now: Date, usage: AiTokenUsage): void {
  const date = formatLocalDate(now)
  const day = readUsageDay(storeDir, date)
  const slot = day.hours[now.getHours()] || { requests: 0, promptTokens: 0, completionTokens: 0 }
  slot.requests += 1
  slot.promptTokens += usage.promptTokens
  slot.completionTokens += usage.completionTokens
  day.hours[now.getHours()] = slot
  day.requests += 1
  day.promptTokens += usage.promptTokens
  day.completionTokens += usage.completionTokens
  writeStoreValue(storeDir, usageStoreKey(date), day, 0)
}

/**
 * 列出记载着用量记录的日期，只认 年/月 两级目录下日期格式的文件名
 * @param {string} storeDir 存储目录
 * @returns {string[]} 日期列表（YYYY-MM-DD，升序）
 */
function listUsageDates(storeDir: string): string[] {
  const dates: string[] = []
  const readDir = (dir: string): string[] => {
    if (!existsSync(dir)) return []
    try {
      return readdirSync(dir)
    } catch {
      return []
    }
  }
  for (const year of readDir(join(storeDir, AI_USAGE_STORE_KEY))) {
    for (const month of readDir(join(storeDir, AI_USAGE_STORE_KEY, year))) {
      for (const file of readDir(join(storeDir, AI_USAGE_STORE_KEY, year, month))) {
        const date = file.replace(/\.json$/, '')
        if (USAGE_DATE_PATTERN.test(date)) dates.push(date)
      }
    }
  }
  return dates.sort()
}

// #endregion

// #region 汇总

/**
 * 汇总用量记录，今天按小时返回 24 个点，其余范围按天返回，无数据的日期补零
 * @param {string} storeDir 存储目录
 * @param {AiUsageRange} range 统计范围，单位为天，0 表示全部
 * @param {Date} now 当前时间，决定今天与范围起点
 * @returns {AiUsageSummary} 汇总结果
 */
export function summarizeAiUsage(storeDir: string, range: AiUsageRange, now: Date): AiUsageSummary {
  const today = formatLocalDate(now)
  const dates: string[] = []
  if (range === 0) {
    // 全部用量从最早的记录日期起算，没有任何记录时只给出今天
    const start = listUsageDates(storeDir)[0] || today
    for (let d = new Date(`${start}T00:00:00`); formatLocalDate(d) <= today; d = addDays(d, 1)) {
      dates.push(formatLocalDate(d))
    }
  } else {
    for (let i = range - 1; i >= 0; i--) dates.push(formatLocalDate(addDays(now, -i)))
  }

  const points: AiUsagePoint[] = dates.map((date) => {
    const day = readUsageDay(storeDir, date)
    return {
      date,
      labels:
        range === 1
          ? Array.from({ length: HOURS_PER_DAY }, (_, h) => `${String(h).padStart(2, '0')}:00`)
          : [`${date.slice(5, 7)}-${date.slice(8, 10)}`],
      promptTokens: range === 1 ? day.hours.map((s) => s.promptTokens) : [day.promptTokens],
      completionTokens: range === 1 ? day.hours.map((s) => s.completionTokens) : [day.completionTokens],
    }
  })

  return {
    range,
    requests: dates.reduce((sum, date) => sum + readUsageDay(storeDir, date).requests, 0),
    promptTokens: points.reduce((sum, p) => sum + p.promptTokens.reduce((s, v) => s + v, 0), 0),
    completionTokens: points.reduce((sum, p) => sum + p.completionTokens.reduce((s, v) => s + v, 0), 0),
    points,
  }
}

// #endregion

// #region IPC 注册

/**
 * 注册 AI 用量查询 IPC
 * @param {() => string} deps.getStoreDir 获取当前档案的存储目录
 */
export function setupAiUsageIpc(deps: { getStoreDir: () => string }): void {
  const { getStoreDir } = deps

  ipcMain.handle('ai:usageSummary', (_e, range: number): AiUsageSummary => {
    const value = SUPPORTED_RANGES.includes(range as AiUsageRange) ? (range as AiUsageRange) : DEFAULT_RANGE
    return summarizeAiUsage(getStoreDir(), value, new Date())
  })
}

// #endregion
