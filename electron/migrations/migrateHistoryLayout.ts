/*
 * @Author: zhengrenfu
 * @Date: 2026-09-24
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-09-24
 * @FilePath: \electron\migrations\migrateHistoryLayout.ts
 * @Description: 历史目录布局迁移：把平铺的日期文件搬进 年/月 子目录
 */

import { existsSync, mkdirSync, readdirSync, renameSync } from 'fs'
import { join } from 'path'

/** 平铺日期文件名，捕获年月用于定位目标目录 */
const DATE_FILE_PATTERN = /^(\d{4})-(\d{2})-\d{2}\.json$/

export interface MigrationResult {
  /** 扫描到的待迁移文件数 */
  total: number
  /** 成功搬进年/月目录的文件数 */
  moved: number
  /** 目标位置已有同名文件而跳过的数量 */
  skipped: number
  /** 迁移失败的数量，原文件保持不动 */
  failed: number
}

/**
 * 把历史目录下平铺的 YYYY-MM-DD.json 搬进 YYYY/MM/ 子目录，只处理顶层日期文件，重复执行不会破坏已分层数据
 * @param {string} historyDir 历史目录
 * @returns {MigrationResult} 迁移统计
 */
export function migrateHistoryLayout(historyDir: string): MigrationResult {
  const result: MigrationResult = { total: 0, moved: 0, skipped: 0, failed: 0 }
  if (!existsSync(historyDir)) return result

  for (const entry of readdirSync(historyDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    const matched = DATE_FILE_PATTERN.exec(entry.name)
    if (!matched) continue
    result.total += 1

    const srcPath = join(historyDir, entry.name)
    const destDir = join(historyDir, matched[1], matched[2])
    const destPath = join(destDir, entry.name)

    if (existsSync(destPath)) {
      result.skipped += 1
      continue
    }

    try {
      mkdirSync(destDir, { recursive: true })
      renameSync(srcPath, destPath)
      result.moved += 1
    } catch (e) {
      result.failed += 1
      console.error('[Migrate] 迁移失败:', srcPath, e)
    }
  }

  return result
}
