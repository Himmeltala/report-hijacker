/*
 * @Author: zhengrenfu
 * @Date: 2026-07-16 01:08:14
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04 12:14:04
 * @FilePath: \src\types\config.ts
 * @Description: 应用配置类型定义
 */

// #region 规则类型

export interface CommentRule {
  enabled: boolean
  label: string
  pattern: string
  isRegex: boolean
  /** 适用任务类型；为空时沿用改造前行为：评论区规则对全部类型生效，边界规则仅对「任务」生效 */
  types?: string[]
}

export type MatchMode = 'all' | 'any'

// 校验规则：平台字段 与 预期来源 的比对描述（配置化校验，不写死）
export interface CheckRule {
  enabled: boolean
  /** 检查名，弹窗展示 */
  label: string
  /** 平台字段路径，如 subject、_embedded.status.name、estimatedTime、customField105、description.raw */
  field: string
  /** 预期来源：text 文本任务字段；config 设置配置值；none 无预期（只查平台字段，归 remote 自检段） */
  expected: 'text' | 'config' | 'none'
  /** 预期键：text 对应 rawTitle 等文本字段；config 对应 handlerName 等配置项 */
  expectedKey?: string
  /** 比对方式 */
  compare:
    | 'equals' // 全等：field 值与预期值相同
    | 'gt' // 大于：field 数值大于预期数值
    | 'gte' // 大于等于：field 数值大于或等于预期数值
    | 'lt' // 小于：field 数值小于预期数值
    | 'lte' // 小于等于：field 数值小于或等于预期数值
    | 'diff-hours' // 偏差：field 值(小时)与预期(小时)差值不超过容差
    | 'field-diff' // 平台内部两字段偏差：field 与 compareField 差值不超过容差
    | 'non-empty' // 非空：平台字段有值（发现漏填）
    | 'list-any' // 白名单：field 值在 values 之中
    | 'regex-any' // 多条件或：rules 任一匹配
    | 'regex-all' // 多条件且：rules 全部匹配
  /** diff-hours 与 field-diff 的容差（小时），默认 3 */
  tolerance?: number
  /** field-diff 的第二个平台字段路径 */
  compareField?: string
  /** list-any 白名单 */
  values?: string[]
  /** regex-any 与 regex-all 的多条件规则，复用 CommentRule 结构 */
  rules?: CommentRule[]
  /** 多条件匹配模式（且/或） */
  matchMode?: MatchMode
  /** 跳过类型，如缺陷 defect */
  skipTypes?: string[]
}

// #endregion

// #region 应用配置

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
