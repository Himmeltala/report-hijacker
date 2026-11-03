/*
 * @Author: zhengrenfu
 * @Date: 2026-08-04
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04
 * @FilePath: \electron\utils.ts
 * @Description: Electron 主进程通用工具函数
 */

import { existsSync, readdirSync, readFileSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'

// #region 文件路径工具

/**
 * 从候选路径列表中返回第一个存在的路径
 * @param {string[]} candidates 候选路径列表
 * @returns {string} 第一个存在的路径，都不存在则返回空字符串
 */
export function resolveFirstExisting(candidates: string[]): string {
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return ''
}

/**
 * 安全读取 JSON 文件，不存在或解析失败时返回默认值
 * @param {string} filePath 文件路径
 * @param {T} fallback 解析失败时的默认值
 * @returns {T} 解析结果或默认值
 */
export function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return fallback
  }
}

/**
 * 异步读取 JSON 文件，不存在或解析失败时返回默认值
 * 批量扫描历史目录时使用，避免同步读阻塞主进程事件循环
 * @param {string} filePath 文件路径
 * @param {T} fallback 解析失败时的默认值
 * @returns {Promise<T>} 解析结果或默认值
 */
export async function readJsonFileAsync<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8'))
  } catch {
    return fallback
  }
}

/**
 * 列出目录中所有 .json 文件的完整文件名
 * @param {string} dir 目标目录
 * @returns {string[]} .json 文件名列表
 */
export function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }
}

/**
 * 列出目录中去除 .json 扩展名的文件名列表
 * @param {string} dir 目标目录
 * @returns {string[]} 去除扩展名后的文件名列表
 */
export function listJsonBasenames(dir: string): string[] {
  return listJsonFiles(dir).map((f) => f.replace('.json', ''))
}

/**
 * 递归列出目录下所有 .json 文件
 * @param {string} dir 目标目录
 * @returns {string[]} 相对于 dir 的路径列表，层级用 / 连接
 */
export function listJsonFilesRecursive(dir: string): string[] {
  const results: string[] = []
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      for (const sub of listJsonFilesRecursive(join(dir, entry.name))) {
        results.push(join(entry.name, sub))
      }
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(entry.name)
    }
  }
  return results
}

// #endregion

// #region URL 与数据解析

/**
 * 从任意 URL 中提取工作包数字 ID（兼容 /wp/ 与 /work_packages/ 两种路径）
 * @param {string} url 包含工作包路径的 URL
 * @returns {string | null} 工作包 ID，无法提取时返回 null
 */
export function extractWpId(url: string | null | undefined): string | null {
  if (!url) return null
  const m = url.match(/\/(?:wp|work_packages)\/(\d+)/)
  return m ? m[1] : null
}

/**
 * 将 ISO 8601 时长转换为小时数（天按 24 小时折算，与平台 ISO 语义及界面展示一致）
 * 例：PT6H 折 6 小时，PT1H30M 折 1.5 小时，P1D 折 24 小时，PT30M 折 0.5 小时
 * @param {string} duration ISO 8601 时长字符串
 * @returns {string} 小时数
 */
export function parseDurationToHours(duration: string): string {
  if (!duration) return ''
  const match = duration.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return duration
  const days = parseInt(match[1] || '0', 10)
  const hours = parseInt(match[2] || '0', 10)
  const minutes = parseInt(match[3] || '0', 10)
  const totalHours = days * 24 + hours + minutes / 60
  return totalHours % 1 === 0 ? String(totalHours) : totalHours.toFixed(1)
}

/**
 * 格式化日期为年月日
 * 入参可为 YYYY-MM-DD 或 ISO 时间串，输出形如 2026年7月16日
 * @param {string} dateStr 日期字符串
 * @returns {string} 格式化结果
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

// #endregion
