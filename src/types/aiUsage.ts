/*
 * @Author: Himmeltala
 * @Date: 2026-11-12 09:08:04
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-12 09:32:00
 * @FilePath: \src\types\aiUsage.ts
 * @Description: AI token 用量统计类型，主进程汇总与设置页图表共用
 */

// #region 统计范围

/** 用量统计范围：0 全部、1 今天、7 最近 7 天、14 最近 14 天、30 最近 30 天 */
export type AiUsageRange = 0 | 1 | 7 | 14 | 30

/** 设置页可选的统计范围及文案 */
export const AI_USAGE_RANGE_OPTIONS: { label: string; value: AiUsageRange }[] = [
  { label: '今天', value: 1 },
  { label: '最近 7 天', value: 7 },
  { label: '最近 14 天', value: 14 },
  { label: '最近 30 天', value: 30 },
  { label: '所有', value: 0 },
]

// #endregion

// #region 记录与汇总

/** 某个小时的用量，只在该小时内发生过请求时存在 */
export interface AiUsageSlot {
  requests: number
  promptTokens: number
  completionTokens: number
}

/** 单日用量记录，存于 store 的 aiUsage/年/月/日期.json */
export interface AiUsageDay {
  date: string
  requests: number
  promptTokens: number
  completionTokens: number
  // 按 0 时到 23 时顺序归档的用量
  hours: AiUsageSlot[]
}

/** 图表上的一个点，今天视图每个点是一个小时，其余范围每个点是一天 */
export interface AiUsagePoint {
  date: string
  labels: string[]
  promptTokens: number[]
  completionTokens: number[]
}

/** 一次查询的汇总结果 */
export interface AiUsageSummary {
  range: AiUsageRange
  requests: number
  promptTokens: number
  completionTokens: number
  points: AiUsagePoint[]
}

// #endregion
