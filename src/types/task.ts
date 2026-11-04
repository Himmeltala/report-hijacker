/*
 * @Author: zhengrenfu
 * @Date: 2026-07-16 10:39:45
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04 12:14:04
 * @FilePath: \src\types\task.ts
 * @Description: 任务领域模型类型定义
 */

import type { ReadonlyRawWorkPackage } from '@/types/remote'

// #region 任务数据

// 字段均来自被拆分的文本块，统一使用 raw 前缀标注文本来源
export interface TaskItem {
  lineNumber: number
  rawSeq: string
  rawEstimatedHours: string
  rawProjectName: string
  // 任务标题（含备注）
  rawTitle: string
  // 处理人（从标题或备注末尾提取）
  rawHandler: string
  // 备注（第一个【】内的内容）
  rawRemark: string
  rawUrl: string
  // 工时或分数
  rawScore: string
  rawText: string
}

// #endregion

// #region 校验结果

// ser 前缀字段为业务字段（服务与平台侧）；raw 前缀字段为文本任务预期值
// remote 为完整 API 响应透传（只读）
export interface ValidationResult {
  serTaskId: string
  serValid: boolean
  rawProjectName: string
  rawTitle: string
  serChecks: ValidationCheck[]
  serError?: string
  remote?: ReadonlyRawWorkPackage
  // 边界校验逐条匹配结果
  serBoundaryResults?: CommentRuleMatch[]
  serBoundaryMatchMode?: string
}

export interface ValidationCheck {
  name: string
  passed: boolean
  expected?: string
  actual?: string
  message?: string
  /** 规则配置信息，展示用 */
  field?: string
  expectedSource?: string
  expectedKey?: string
  compare?: string
}

export interface CommentRuleMatch {
  label: string
  pattern: string
  matched: boolean
  matchedContent?: string
  error?: string
}

// #endregion
