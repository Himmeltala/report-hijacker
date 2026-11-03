/*
 * @Author: zhengrenfu
 * @Date: 2026-07-14 00:06:11
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-07-14 12:14:04
 * @FilePath: \..\\src\\utils\\parser.ts
 * @Description: 描述
 */

import moment from 'moment'
import type { TaskItem } from '@/types/task'
import { parseHoursValue } from '@/utils/hours'

// #region 常量

// 解析正则必须包含的具名组，与 TaskItem 字段对应
export const EXPECTED_GROUPS = ['seq', 'estimatedHours', 'projectName', 'remark', 'url', 'score'] as const

// #endregion

// #region 正则校验

/**
 * 校验自定义正则是否包含全部必需具名组，返回缺失列表
 * @param {string} pattern 用户配置的任务解析正则
 * @returns {string[]} 缺失的具名组名称列表，正则非法时返回全部必需组
 */
export function validateRegexGroups(pattern: string): string[] {
  try {
    const re = new RegExp(pattern)
    const src = re.source
    return EXPECTED_GROUPS.filter((g) => !new RegExp(`\\(\\?<${g}>`).test(src))
  } catch {
    return [...EXPECTED_GROUPS]
  }
}

// #endregion

// #region 任务解析

/**
 * 解析原始文本，返回任务列表和未识别行
 * @param text 原始文本
 * @param regexStr 正则表达式字符串（来自设置 parsing.taskRegex）
 * @returns 解析结果
 */
export function parseTaskText(text: string, regexStr: string): { tasks: TaskItem[]; unrecognized: string[] } {
  let regex: RegExp
  try {
    regex = new RegExp(regexStr)
  } catch {
    return {
      tasks: [],
      unrecognized: text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    }
  }

  const tasks: TaskItem[] = []
  const unrecognized: string[] = []

  let lineNumber = 0
  for (const line of text.split('\n')) {
    // 行号始终按原始行递增，空行也占位，保证与输入文本行号一致
    lineNumber++
    const trimmed = line.trim()
    if (!trimmed) continue

    const match = trimmed.match(regex)
    if (match?.groups) {
      // 必填具名组必须在正则中定义（值允许为空，如可选的自评工时前缀），与 RegexTester 校验一致
      const missing = EXPECTED_GROUPS.filter((g) => !(g in (match.groups as Record<string, string>)))
      if (missing.length > 0) {
        unrecognized.push(trimmed)
        continue
      }
      const g = match.groups
      const remarkRaw = (g.remark || '').trim()
      // 处理人从备注末尾提取（与提取页一致），标题剥离处理人部分
      const handler = extractHandler(remarkRaw)
      const title = handler ? remarkRaw.slice(0, -(handler.length + 1)).trim() : remarkRaw
      tasks.push({
        lineNumber,
        rawSeq: g.seq || '',
        rawEstimatedHours: g.estimatedHours || '',
        rawProjectName: g.projectName?.replace(/-$/, '').trim() || '',
        rawTitle: title,
        rawHandler: handler,
        rawRemark: remarkRaw,
        rawUrl: g.url?.trim() || '',
        rawScore: g.score || '',
        rawText: trimmed,
      })
    } else {
      unrecognized.push(trimmed)
    }
  }

  return { tasks, unrecognized }
}

// #endregion

// #region 辅助函数

/**
 * 从备注文本末尾提取处理人（最后一个 - 之后的部分）
 * @param {string} remark 备注文本（如「完成登录-张三」）
 * @returns {string} 处理人姓名，无分隔符时返回空字符串
 */
export function extractHandler(remark: string): string {
  const idx = remark.lastIndexOf('-')
  return idx >= 0 ? remark.slice(idx + 1).trim() : ''
}

/**
 * 将时长字符串转为小时数（ISO 8601 或纯数字小时，与校验引擎 rules 共用 parseHoursValue）
 * @param {string} isoDuration 时长字符串，如 PT8H / PT30M / P1D / "6"
 * @returns {number} 小时数，天按 24 小时折算
 */
export function convertIso8601ToHours(isoDuration: string | undefined): number {
  return parseHoursValue(isoDuration || '')
}

/**
 * 格式化 ISO8601 时长字符串，按格式占位符输出天、时、分
 * @param {string} isoDuration ISO8601 时长，如 P2D、P1DT2H
 * @param {string} [format] 格式模板，占位符 d 天、h 时、m 分，默认 "d天h时"
 * @returns {string} 格式化结果，空值返回空字符串
 */
export function formatIso8601Duration(isoDuration: string, format = 'd天h时'): string {
  if (!isoDuration) return ''
  const d = moment.duration(isoDuration)
  return format
    .replace(/d+/g, String(Math.floor(d.asDays())))
    .replace(/h+/g, String(d.hours()))
    .replace(/m+/g, String(d.minutes()))
}

// #endregion
