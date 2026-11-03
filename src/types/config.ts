/*
 * @Author: zhengrenfu
 * @Date: 2026-07-16 01:08:14
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04 12:14:04
 * @FilePath: \src\types\config.ts
 * @Description: 应用配置类型定义
 */

// #region 规则类型

// 匹配规则（评论区检查 / 边界校验共用）
export interface CommentRule {
  enabled: boolean
  label: string
  pattern: string
  isRegex: boolean
  /** 适用任务类型；为空时沿用改造前行为：评论区规则对全部类型生效，边界规则仅对「任务」生效 */
  types?: string[]
}

// 规则匹配模式
export type MatchMode = 'all' | 'any'

// 校验规则：平台字段 与 预期来源 的比对描述（配置化校验，不写死）
export interface CheckRule {
  enabled: boolean
  /** 检查名（弹窗展示，如「任务状态」「所属部门」） */
  label: string
  /** 平台字段路径，如 subject / _embedded.status.name / _embedded.project.name /
      _embedded.responsible.name / estimatedTime / customField105 / customField106 /
      startDate / dueDate / description.raw */
  field: string
  /** 预期来源：text 文本任务字段；config 设置配置值；none 无预期（只查平台字段，归 remote 自检段） */
  expected: 'text' | 'config' | 'none'
  /** 预期键：text 对应 rawTitle 等文本字段；config 对应 handlerName 等配置项 */
  expectedKey?: string
  /** 比对方式 */
  compare:
    | 'equals' // 全等：field 值与预期值相同
    | 'gt' // 大于：field 数值 > 预期数值
    | 'gte' // 大于等于：field 数值大于或等于预期数值
    | 'lt' // 小于：field 数值 < 预期数值
    | 'lte' // 小于等于：field 数值小于或等于预期数值
    | 'diff-hours' // 偏差：field 值(小时)与预期(小时)差值不超过容差
    | 'field-diff' // 平台内部两字段偏差：field 与 compareField 差值不超过容差
    | 'non-empty' // 非空：平台字段有值（发现漏填）
    | 'list-any' // 白名单：field 值 ∈ values
    | 'regex-any' // 多条件或：rules 任一匹配
    | 'regex-all' // 多条件且：rules 全部匹配
  /** diff-hours / field-diff 容差（小时），默认 3 */
  tolerance?: number
  /** field-diff 的第二个平台字段路径 */
  compareField?: string
  /** list-any 白名单（如任务状态：['待检查','已实现']） */
  values?: string[]
  /** regex-any / regex-all 的多条件规则（复用 CommentRule 结构，如所属部门、任务状态多条件） */
  rules?: CommentRule[]
  /** 多条件匹配模式（或/且） */
  matchMode?: MatchMode
  /** 跳过类型（如缺陷 defect），沿用现状能力 */
  skipTypes?: string[]
}

// #endregion

// #region 应用配置

// 配置
export interface AppConfig {
  cookie: string
  handlerName: string
  boundaryRules: CommentRule[]
  boundaryMatchMode: MatchMode
  taskRegex: string
  apiBaseUrl: string
  templatePath: string
  groupRegex: string
  commentRules: CommentRule[]
  commentMatchMode: MatchMode
  checkRules: CheckRule[]
  /** 是否启用 AI 审查（模型服务与提示词由主进程直接读设置，不走渲染层） */
  aiEnabled: boolean
}

// #endregion
