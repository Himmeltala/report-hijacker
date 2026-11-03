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

// 解析后的一条任务
// 字段均来自被拆分的文本块，统一使用 raw 前缀标注文本来源
export interface TaskItem {
  // 原始行号
  lineNumber: number
  // 序号（1. 2. 3. ...）
  rawSeq: string
  // 自评预估工时
  rawEstimatedHours: string
  // 项目名称
  rawProjectName: string
  // 任务标题（含备注）
  rawTitle: string
  // 处理人（从标题/备注末尾提取）
  rawHandler: string
  // 备注（第一个【】内的内容）
  rawRemark: string
  // 任务链接
  rawUrl: string
  // 工时/分数
  rawScore: string
  // 原始文本行
  rawText: string
}

// #endregion

// #region 校验结果

// 校验结果
// ser 前缀字段为业务字段（服务/平台侧）；raw 前缀字段为文本任务预期值
// remote 透传完整 API 响应（只读），消费端直接导航原始路径
export interface ValidationResult {
  serTaskId: string
  serValid: boolean
  rawProjectName: string
  rawTitle: string
  serChecks: ValidationCheck[]
  serError?: string
  remote?: ReadonlyRawWorkPackage
  // 边界校验逐条匹配结果（与评论匹配结果同构）
  serBoundaryResults?: CommentRuleMatch[]
  // 边界匹配模式
  serBoundaryMatchMode?: string
}

// 单项校验（通用展示结构，保持原名）
export interface ValidationCheck {
  name: string
  passed: boolean
  expected?: string
  actual?: string
  message?: string
  /** 规则配置信息（展示用，与设置页任务校验布局对应） */
  field?: string
  expectedSource?: string
  expectedKey?: string
  compare?: string
}

// 规则匹配结果（评论区与边界校验共用）
export interface CommentRuleMatch {
  label: string
  pattern: string
  matched: boolean
  matchedContent?: string
  error?: string
}

// #endregion
