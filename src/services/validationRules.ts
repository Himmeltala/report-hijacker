/*
 * @Author: zhengrenfu
 * @Date: 2026-08-04 01:19:46
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-06 12:14:04
 * @FilePath: \src\services\validationRules.ts
 * @Description: 任务校验规则纯函数模块，主进程与渲染进程共享同一份校验逻辑
 */

import type { CheckRule, CommentRule, MatchMode } from '@/types/config'
import type { CommentRuleMatch, ValidationCheck, ValidationResult } from '@/types/task'
import { parseHoursValue } from '@/utils/hours'

// #region 类型定义

// 校验期望参数
export interface WorkPackageExpectations {
  taskId: string
  rawSeq: string
  rawProjectName: string
  rawTitle: string
  rawScore: string
  rawEstimatedHours: string
  rawRemark: string
  boundaryRules: CommentRule[]
  boundaryMatchMode: MatchMode
  checkRules: CheckRule[]
  taskDate?: string
}

// 校验输出（与 ValidationResult 的对应字段同构，避免重复定义）
export type WorkPackageValidation = Pick<
  ValidationResult,
  'serChecks' | 'serValid' | 'serBoundaryResults' | 'serBoundaryMatchMode'
>

// #endregion

// #region 常量

// 任务类型常量
const TYPE_TASK = '任务'

// 预编译的描述段落提取正则（1. 是什么）
const WHAT_SECTION_RE = /1\.\s*是什么[：:]\s*([\s\S]*?)(?=\d+\.\s*\S+[：:]|\n*$)/

// #endregion

// #region 工具函数

/**
 * 将时长字符串转换为小时数（ISO 8601 或纯数字小时，与渲染端 parser 保持一致）
 * @param {string} isoDuration 时长字符串，如 PT6H / P1DT2H / "6"
 * @returns {number} 小时数
 */
export function isoToHours(isoDuration: string): number {
  return parseHoursValue(isoDuration)
}

/**
 * 对文本执行规则匹配（正则或包含），返回逐条匹配结果
 * @param {string} text 待匹配文本
 * @param {Array<Pick<CommentRule, 'label' | 'pattern' | 'isRegex'>>} rules 启用且非空的规则列表
 * @param {MatchMode} mode 匹配模式（all 全部匹配 / any 任一匹配）
 * @returns {CommentRuleMatch[]} 每条规则的匹配结果
 */
export function matchTextRules(
  text: string,
  rules: Array<Pick<CommentRule, 'label' | 'pattern' | 'isRegex'>>,
  mode: MatchMode,
): CommentRuleMatch[] {
  return rules.map((rule): CommentRuleMatch => {
    const item: CommentRuleMatch = { label: rule.label || rule.pattern, pattern: rule.pattern, matched: false }
    if (!rule.pattern) {
      item.error = '规则为空'
      return item
    }
    try {
      if (rule.isRegex) {
        const m = text.match(new RegExp(rule.pattern, 'i'))
        item.matched = !!m
        if (m) item.matchedContent = m[0]
      } else {
        const found = text.includes(rule.pattern)
        item.matched = found
        if (found) item.matchedContent = rule.pattern
      }
    } catch (e: any) {
      item.error = '正则错误: ' + e.message
    }
    return item
  })
}

/**
 * 根据匹配模式判定整体是否通过
 * @param {CommentRuleMatch[]} matches 匹配结果列表
 * @param {MatchMode} mode 匹配模式
 * @returns {boolean} 是否通过
 */
export function isRulesPassed(matches: CommentRuleMatch[], mode: MatchMode): boolean {
  if (matches.length === 0) return true
  if (mode === 'all') return matches.every((r) => r.matched)
  return matches.some((r) => r.matched)
}

/**
 * 提取未匹配规则的标签列表
 * @param {CommentRuleMatch[]} matches 匹配结果列表
 * @returns {string} 逗号分隔的未匹配标签
 */
export function failedRuleLabels(matches: CommentRuleMatch[]): string {
  return matches
    .filter((r) => !r.matched)
    .map((r) => r.label)
    .join('、')
}

// #endregion

// #region 内部辅助函数

/**
 * 从任务描述中提取段落内容
 * @param {string} descriptionRaw 任务描述原文
 * @param {RegExp} sectionRe 段落提取正则
 * @returns {string} 段落内容，未找到则返回空字符串
 */
function extractSection(descriptionRaw: string, sectionRe: RegExp): string {
  return descriptionRaw.match(sectionRe)?.[1] || ''
}

/**
 * 按点分路径从工作包详情取值，自定义字段兼容 _links 下的 title 兜底
 * @param {any} detail OpenProject 工作包 API 响应
 * @param {string} fieldPath 字段路径，如 _embedded.status.name
 * @returns {string} 字段值，取不到返回空字符串
 */
function getRemoteValue(detail: any, fieldPath: string): string {
  const parts = fieldPath.split('.')
  let val: any = detail
  for (const p of parts) {
    if (val == null) break
    val = val[p]
  }
  if ((val == null || val === '') && /^customField\d+$/.test(parts[parts.length - 1])) {
    val = detail?._links?.[parts[parts.length - 1]]?.title
  }
  return val == null ? '' : String(val)
}

/**
 * 解析规则预期值：text 取文本任务字段，config 取配置项
 * @param {CheckRule} rule 校验规则
 * @param {WorkPackageExpectations} exp 期望参数
 * @returns {string} 预期值
 */
function resolveExpected(rule: CheckRule, exp: WorkPackageExpectations): string {
  if (rule.expected === 'config' || rule.expected === 'text') {
    return String((exp as any)[rule.expectedKey || ''] || '')
  }
  return ''
}

/**
 * 执行单条校验规则
 * @param {CheckRule} rule 校验规则
 * @param {any} detail 工作包详情
 * @param {WorkPackageExpectations} exp 期望参数
 * @returns {ValidationCheck | null} 检查结果，跳过类型时返回 null
 */
function runCheckRule(rule: CheckRule, detail: any, exp: WorkPackageExpectations): ValidationCheck | null {
  const taskType = detail?._embedded?.type?.name || detail?._links?.type?.title || ''
  // 跳过指定类型（如缺陷不校验部门、预估时长）
  if (rule.skipTypes?.includes(taskType)) return null

  const actual = getRemoteValue(detail, rule.field)
  const expected = resolveExpected(rule, exp)
  let passed = false
  let message = ''
  let expectedLabel = expected
  let actualLabel = actual

  switch (rule.compare) {
    case 'equals':
      passed = actual === expected
      message = passed ? '匹配' : '不匹配'
      break
    case 'gt': {
      const actualNum = isoToHours(actual)
      const expNum = parseFloat(expected || rule.expectedKey || '0')
      passed = actualNum > expNum
      expectedLabel = `> ${expNum}h`
      actualLabel = `${actualNum.toFixed(1)}h`
      message = passed ? `${actualNum.toFixed(1)}h > ${expNum}h` : `${actualNum.toFixed(1)}h <= ${expNum}h`
      break
    }
    case 'gte': {
      const actualNum = isoToHours(actual)
      const expNum = parseFloat(expected || rule.expectedKey || '0')
      passed = actualNum >= expNum
      expectedLabel = `>= ${expNum}h`
      actualLabel = `${actualNum.toFixed(1)}h`
      message = passed ? `${actualNum.toFixed(1)}h >= ${expNum}h` : `${actualNum.toFixed(1)}h < ${expNum}h`
      break
    }
    case 'lt': {
      const actualNum = isoToHours(actual)
      const expNum = parseFloat(expected || rule.expectedKey || '0')
      passed = actualNum < expNum
      expectedLabel = `< ${expNum}h`
      actualLabel = `${actualNum.toFixed(1)}h`
      message = passed ? `${actualNum.toFixed(1)}h < ${expNum}h` : `${actualNum.toFixed(1)}h >= ${expNum}h`
      break
    }
    case 'lte': {
      const actualNum = isoToHours(actual)
      const expNum = parseFloat(expected || rule.expectedKey || '0')
      passed = actualNum <= expNum
      expectedLabel = `<= ${expNum}h`
      actualLabel = `${actualNum.toFixed(1)}h`
      message = passed ? `${actualNum.toFixed(1)}h <= ${expNum}h` : `${actualNum.toFixed(1)}h > ${expNum}h`
      break
    }
    case 'diff-hours': {
      const actualHours = isoToHours(actual)
      const expHours = parseFloat(expected || rule.expectedKey || '0')
      const tolerance = rule.tolerance ?? 3
      const diff = Math.abs(actualHours - expHours)
      passed = diff <= tolerance
      expectedLabel = `${expected}h`
      actualLabel = `${actualHours.toFixed(1)}h`
      message = passed
        ? `偏差 ${diff.toFixed(1)}h，在 ${tolerance}h 范围内`
        : `偏差 ${diff.toFixed(1)}h，超过 ${tolerance}h 范围`
      break
    }
    case 'field-diff': {
      const a = isoToHours(actual)
      const b = isoToHours(getRemoteValue(detail, rule.compareField || ''))
      const tolerance = rule.tolerance ?? 3
      const diff = Math.abs(a - b)
      passed = diff <= tolerance
      expectedLabel = `偏差不超过 ${tolerance}h`
      actualLabel = `${diff.toFixed(1)}h`
      message = passed
        ? `偏差 ${diff.toFixed(1)}h，在 ${tolerance}h 范围内`
        : `偏差 ${diff.toFixed(1)}h，超过 ${tolerance}h 范围`
      break
    }
    case 'non-empty':
      passed = actual.trim() !== ''
      message = passed ? '已填写' : '未填写'
      expectedLabel = '非空'
      break
    case 'list-any': {
      const values = rule.values || []
      passed = values.includes(actual)
      expectedLabel = values.join(' / ')
      message = passed ? '匹配' : `不在期望列表中，实际 ${actual}`
      break
    }
    case 'regex-any':
    case 'regex-all': {
      const activeRules = (rule.rules || []).filter((r) => r.enabled && r.pattern)
      const mode = rule.matchMode || (rule.compare === 'regex-all' ? 'all' : 'any')
      const results = matchTextRules(actual, activeRules, mode)
      passed = isRulesPassed(results, mode)
      const failedLabels = failedRuleLabels(results)
      const modeLabel = mode === 'all' ? 'AND' : 'OR'
      expectedLabel = activeRules.map((r) => r.label || r.pattern).join(' / ')
      message = passed ? `匹配（${modeLabel}）` : `未匹配（${modeLabel}）: ${failedLabels}`
      break
    }
    default:
      return null
  }

  return {
    name: rule.label,
    passed,
    message,
    expected: expectedLabel,
    actual: actualLabel,
    // 规则配置信息（与设置页任务校验布局对应）
    field: rule.field,
    expectedSource: rule.expected,
    expectedKey: rule.expectedKey,
    compare: rule.compare,
  }
}

// #endregion

// #region 主校验函数

/**
 * 对工作包详情执行全部校验检查
 * @param {any} detail OpenProject 工作包 API 响应
 * @param {WorkPackageExpectations} exp 期望参数
 * @returns {WorkPackageValidation} 校验结果
 */
export function validateWorkPackage(detail: any, exp: WorkPackageExpectations): WorkPackageValidation {
  const embedded = detail._embedded || {}
  const descriptionRaw = detail.description?.raw || ''
  const taskType = embedded.type?.name || detail._links?.type?.title || ''

  const checks: ValidationCheck[] = []
  let isValid = true
  let boundaryResults: CommentRuleMatch[] | undefined
  let boundaryMatchMode: string | undefined

  const fail = (passed: boolean) => {
    if (!passed) isValid = false
  }

  // 配置化校验规则逐条执行（任务ID/标题/项目/处理人/部门/状态/自评时长/偏差/预估时长等）
  for (const rule of exp.checkRules || []) {
    if (!rule.enabled) continue
    const check = runCheckRule(rule, detail, exp)
    if (!check) continue
    checks.push(check)
    fail(check.passed)
  }

  // 1.是什么 段落检查：边界规则按适用类型筛选，未选类型时沿用改造前行为（仅任务）
  const sectionWhat = extractSection(descriptionRaw, WHAT_SECTION_RE)
  const boundaryVal = sectionWhat.match(/边界[：:]\s*(.+)/)?.[1]?.trim() || ''
  const activeBoundaryRules = exp.boundaryRules.filter(
    (r) => r.enabled && r.pattern && (r.types?.length ? r.types.includes(taskType) : taskType === TYPE_TASK),
  )
  if (activeBoundaryRules.length > 0) {
    const mode = exp.boundaryMatchMode || 'any'
    const results = matchTextRules(boundaryVal, activeBoundaryRules, mode)
    const boundaryOk = isRulesPassed(results, mode)
    const modeLabel = mode === 'all' ? 'AND' : 'OR'
    const failedLabels = failedRuleLabels(results)
    checks.push({
      name: '边界',
      passed: boundaryOk,
      message: boundaryOk ? `边界校验通过（${modeLabel}）` : `边界校验未通过（${modeLabel}），未匹配: ${failedLabels}`,
      expected: activeBoundaryRules.map((r) => r.label || r.pattern).join(' / '),
      actual: boundaryVal || '(未设置)',
    })
    fail(boundaryOk)

    // 逐条匹配结果供渲染端展示
    boundaryResults = results
    boundaryMatchMode = mode
  }

  // 日期校验（仅限类型为"任务"）
  if (taskType === TYPE_TASK && exp.taskDate && (detail.startDate || detail.dueDate)) {
    const dateOk =
      (!detail.startDate || exp.taskDate >= detail.startDate) && (!detail.dueDate || exp.taskDate <= detail.dueDate)
    checks.push({
      name: '日期',
      passed: dateOk,
      message: dateOk ? '日期在范围内' : '日期超出范围',
      expected:
        detail.startDate && detail.dueDate
          ? `${detail.startDate} ~ ${detail.dueDate}`
          : detail.startDate || detail.dueDate || '(无)',
      actual: exp.taskDate,
    })
    fail(dateOk)
  }

  return {
    serChecks: checks,
    serValid: isValid,
    serBoundaryResults: boundaryResults,
    serBoundaryMatchMode: boundaryMatchMode,
  }
}

// #endregion
