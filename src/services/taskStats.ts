/*
 * @Author: zhengrenfu
 * @Date: 2026-08-04 22:40:36
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04 12:14:04
 * @FilePath: \src\services\taskStats.ts
 * @Description: 任务统计计算服务，统一自评/预估时长汇总与评价计数逻辑
 */

import { convertIso8601ToHours } from '@/utils/parser'

// #region 类型定义

export interface TaskStats {
  totalTasks: number
  totalSelfHours: number
  totalEstHours: number
  totalScore: number
  evaluationGood: number
  evaluationPass: number
  evaluationOther: number
}

// 远程工作包数据的最小形状：customField 系列平台返回数字，也可能为字符串，字段类型与 RawWorkPackage 兼容
export interface StatsRemote {
  estimatedTime?: string
  customField105?: string | number
  _links?: {
    customField62?: {
      title?: string
    }
  }
}

// #endregion

// #region 统计计算

/**
 * @param {Array<{rawScore?: string}>} tasks 任务列表，用于统计任务数和总分
 * @param {Array<StatsRemote | null | undefined>} remotes 远程工作包数据列表（与 tasks 对应）
 * @returns {TaskStats} 统计结果
 */
export function computeTaskStats(
  tasks: Array<{ rawScore?: string }>,
  remotes: Array<StatsRemote | null | undefined>,
): TaskStats {
  const totalTasks = tasks.length
  const totalSelfHours = remotes.reduce((s, r) => s + convertIso8601ToHours(r?.estimatedTime || ''), 0)
  const totalEstHours = remotes.reduce((s, r) => s + (parseFloat(String(r?.customField105 ?? '')) || 0), 0)
  const totalScore = tasks.reduce((s, t) => s + (parseFloat(t.rawScore || '') || 0), 0)

  const evaluationTitle = (r: StatsRemote | null | undefined) => r?._links?.customField62?.title || ''
  const evaluationGood = remotes.filter((r) => evaluationTitle(r) === '好').length
  const evaluationPass = remotes.filter((r) => evaluationTitle(r) === '合格').length
  // 其他含未评价任务，保证好、合格、其他三者合计等于任务数
  const evaluationOther = remotes.filter((r) => {
    const title = evaluationTitle(r)
    return title !== '好' && title !== '合格'
  }).length

  return {
    totalTasks,
    totalSelfHours: Math.round(totalSelfHours * 100) / 100,
    totalEstHours: Math.round(totalEstHours * 100) / 100,
    totalScore: Math.round(totalScore * 100) / 100,
    evaluationGood,
    evaluationPass,
    evaluationOther,
  }
}

// #endregion
