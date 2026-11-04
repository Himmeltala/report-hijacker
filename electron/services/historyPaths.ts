/*
 * @Author: zhengrenfu
 * @Date: 2026-09-24
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-09-24
 * @FilePath: \electron\services\historyPaths.ts
 * @Description: 历史目录布局：日期校验、年月分层路径与日期枚举
 */

import { readdirSync, rmdirSync, statSync } from 'fs'
import type { Dirent } from 'fs'
import { basename, join } from 'path'

/** 历史日期文件名的合法格式（防止路径注入） */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const YEAR_DIR_PATTERN = /^\d{4}$/

/** 月目录名格式，月份补零，保证按字符串排序与真实月份一致 */
const MONTH_DIR_PATTERN = /^\d{2}$/

/**
 * 校验历史日期参数，格式或日历非法时直接抛错
 * @param {string} date 日期字符串（YYYY-MM-DD）
 */
export function assertValidDate(date: string): void {
  if (!DATE_PATTERN.test(date)) {
    throw new Error(`非法日期格式: ${date}`)
  }
  // 校验日历合法性，防止写入无法归类的日期文件
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(year, month - 1, day)
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    throw new Error(`非法日期: ${date}`)
  }
}

/**
 * 由日期算出历史文件路径：history/YYYY/MM/YYYY-MM-DD.json
 * @param {string} historyDir 历史目录
 * @param {string} date 日期字符串（YYYY-MM-DD）
 */
export function historyFilePath(historyDir: string, date: string): string {
  return join(historyDir, date.slice(0, 4), date.slice(5, 7), `${date}.json`)
}

/**
 * 列出目录项，目录不存在或读不动时返回空数组
 * @param {string} dir 目标目录
 */
function readDirSafe(dir: string): Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

/**
 * 判断日期是否合法（格式与日历都合法）
 * @param {string} date 日期字符串
 */
function isValidDate(date: string): boolean {
  try {
    assertValidDate(date)
    return true
  } catch {
    return false
  }
}

/**
 * 列出历史目录下的日期
 * 只认文件名年月与目录一致的 年/月 两级目录，避免把误放进来的文件当成历史数据；传入范围时只读取相交的年月目录
 * @param {string} historyDir 历史目录
 * @param {{ startDate?: string; endDate?: string }} [range] 日期范围（YYYY-MM-DD，闭区间）
 * @returns {string[]} 日期列表（YYYY-MM-DD）
 */
export function listHistoryDates(
  historyDir: string,
  range?: { startDate?: string; endDate?: string },
): string[] {
  const { startDate, endDate } = range || {}
  // 年目录与月目录名都是补零字符串，可直接按字典序比较
  const startYear = startDate?.slice(0, 4)
  const endYear = endDate?.slice(0, 4)
  const startMonth = startDate?.slice(0, 7)
  const endMonth = endDate?.slice(0, 7)
  const dates: string[] = []
  for (const year of readDirSafe(historyDir)) {
    if (!year.isDirectory() || !YEAR_DIR_PATTERN.test(year.name)) continue
    if (startYear && year.name < startYear) continue
    if (endYear && year.name > endYear) continue
    for (const month of readDirSafe(join(historyDir, year.name))) {
      if (!month.isDirectory() || !MONTH_DIR_PATTERN.test(month.name)) continue
      const yearMonth = `${year.name}-${month.name}`
      if (startMonth && yearMonth < startMonth) continue
      if (endMonth && yearMonth > endMonth) continue
      for (const file of readDirSafe(join(historyDir, year.name, month.name))) {
        if (!file.isFile() || !file.name.endsWith('.json')) continue
        const date = file.name.slice(0, -'.json'.length)
        if (date.slice(0, 4) !== year.name || date.slice(5, 7) !== month.name) continue
        if (startDate && date < startDate) continue
        if (endDate && date > endDate) continue
        if (isValidDate(date)) dates.push(date)
      }
    }
  }
  return dates
}

/**
 * 删除日期文件后清理留下的空月目录与空年目录
 * @param {string} historyDir 历史目录
 * @param {string} date 日期字符串（YYYY-MM-DD）
 */
export function pruneEmptyDateDirs(historyDir: string, date: string): void {
  const yearPath = join(historyDir, date.slice(0, 4))
  // 目录非空时 rmdir 抛错，属于正常情况
  try {
    rmdirSync(join(yearPath, date.slice(5, 7)))
  } catch {
    // 月份目录下还有别的日期文件
  }
  try {
    rmdirSync(yearPath)
  } catch {
    // 年份目录下还有别的月份
  }
}

/** 恢复备份时，同一日期在源目录里的一份候选文件 */
interface RestoreCandidate {
  /** 相对源目录的路径 */
  relPath: string
  /** 文件修改时间（毫秒） */
  mtimeMs: number
  /** 是否位于 年/月 子目录下 */
  layered: boolean
}

/** 恢复备份时，按日期挑出来的唯一来源 */
export interface RestorePick {
  /** 每个日期的来源文件，按日期升序排列 */
  sources: Array<{ date: string; relPath: string }>
  /** 源目录里存在多份来源的日期个数 */
  conflictCount: number
}

/**
 * 判断相对路径是否正好落在该日期的 年/月 子目录下
 * @param {string} relPath 相对源目录的路径
 * @param {string} date 日期字符串（YYYY-MM-DD）
 */
function isLayeredPath(relPath: string, date: string): boolean {
  return relPath === join(date.slice(0, 4), date.slice(5, 7), `${date}.json`)
}

/**
 * 比较两份候选文件，返回正数表示 a 更优先
 * 保证结果不随目录读取顺序变化
 * @param {RestoreCandidate} a 候选文件甲
 * @param {RestoreCandidate} b 候选文件乙
 */
function compareCandidates(a: RestoreCandidate, b: RestoreCandidate): number {
  if (a.mtimeMs !== b.mtimeMs) return a.mtimeMs - b.mtimeMs
  if (a.layered !== b.layered) return a.layered ? 1 : -1
  return a.relPath.localeCompare(b.relPath)
}

/**
 * 从源目录的文件列表中为每个日期挑出唯一来源
 * 备份目录可能同一日期同时存在平铺与分层两份文件，不挑拣则恢复结果不稳定
 * @param {string} srcDir 源目录
 * @param {string[]} relPaths 相对源目录的 .json 文件路径列表
 */
export function pickRestoreSources(srcDir: string, relPaths: string[]): RestorePick {
  const best = new Map<string, RestoreCandidate>()
  const conflicted = new Set<string>()

  for (const relPath of relPaths) {
    const date = basename(relPath).replace(/\.json$/, '')
    if (!isValidDate(date)) {
      console.warn('[History] 跳过非日期命名的文件:', relPath)
      continue
    }
    let mtimeMs: number
    try {
      mtimeMs = statSync(join(srcDir, relPath)).mtimeMs
    } catch (e) {
      console.warn('[History] 跳过读不到的文件:', relPath, e)
      continue
    }
    const candidate: RestoreCandidate = { relPath, mtimeMs, layered: isLayeredPath(relPath, date) }
    const previous = best.get(date)
    if (!previous) {
      best.set(date, candidate)
      continue
    }
    const winner = compareCandidates(candidate, previous) > 0 ? candidate : previous
    const loser = winner === candidate ? previous : candidate
    console.warn(`[History] ${date} 在源目录里有多份，取 ${winner.relPath}，忽略 ${loser.relPath}`)
    conflicted.add(date)
    best.set(date, winner)
  }

  const sources: Array<{ date: string; relPath: string }> = []
  best.forEach((candidate, date) => {
    sources.push({ date, relPath: candidate.relPath })
  })
  sources.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return { sources, conflictCount: conflicted.size }
}
