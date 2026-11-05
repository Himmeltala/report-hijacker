/*
 * @Author: zhengrenfu
 * @Date: 2026-08-04
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-05 10:45:00
 * @FilePath: \electron\utils.ts
 * @Description: Electron 主进程通用工具函数
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { readFile } from 'fs/promises'
import { dirname } from 'path'
import type { BrowserWindow } from 'electron'

// #region 文件路径工具

/** 从候选路径中返回第一个存在的路径，都不存在则返回空字符串 */
export function resolveFirstExisting(candidates: string[]): string {
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return ''
}

/** 读取 JSON 文件，不存在或解析失败时返回默认值 */
export function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    return fallback
  }
}

/** 异步读取 JSON 文件，不存在或解析失败时返回默认值，避免同步读阻塞主进程事件循环 */
export async function readJsonFileAsync<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8'))
  } catch {
    return fallback
  }
}

// 原子写入 JSON 文件：先写临时文件再重命名，崩溃时不会留下截断文件
export function writeJsonAtomic(filePath: string, data: any, indent = 2): void {
  mkdirSync(dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.tmp`
  writeFileSync(tmpPath, JSON.stringify(data, null, indent), 'utf-8')
  renameSync(tmpPath, filePath)
}

/** 列出目录中所有 .json 文件，返回完整文件名 */
export function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }
}

/** 列出目录中所有 .json 文件，返回去除扩展名的文件名 */
export function listJsonBasenames(dir: string): string[] {
  return listJsonFiles(dir).map((f) => f.replace('.json', ''))
}

// #endregion

// #region URL 与数据解析

/** 从任意 URL 中提取工作包数字 ID，兼容 /wp/ 与 /work_packages/ 两种路径，无法提取时返回 null */
export function extractWpId(url: string | null | undefined): string | null {
  if (!url) return null
  const m = url.match(/\/(?:wp|work_packages)\/(\d+)/)
  return m ? m[1] : null
}

/** 将 ISO 8601 时长转换为小时数，天按 24 小时折算 */
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

/** 格式化日期为年月日，入参可为 YYYY-MM-DD 或 ISO 时间串，输出形如 2026年7月16日 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

// #endregion

// #region 窗口事件

// 向渲染进程发送事件，窗口不存在或已销毁时静默跳过
export function sendToWindow(getWindow: () => BrowserWindow | null, channel: string, ...args: any[]): void {
  const win = getWindow()
  if (!win || win.isDestroyed()) return
  win.webContents.send(channel, ...args)
}

// #endregion
