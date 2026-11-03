/*
 * @Author: zhengrenfu
 * @Date: 2026-09-30 17:36:40
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-09-30 17:36:40
 * @FilePath: \src\services\taskOrder.ts
 * @Description: 任务排序比较器，主进程与渲染进程共用同一套排序口径
 */

// #region 常量

/** 平台状态排序优先级 */
export const STATUS_ORDER = ['规划中', '实现中', '待检查', '已实现']

/** 平台类型排序优先级 */
export const TYPE_ORDER = ['缺陷', '任务']

// #endregion

// #region 比较器

/** 参与排序的字段，取自历史任务条目或工作台通知 */
export interface TaskOrderFields {
  /** 平台状态名，取不到时排最后 */
  status?: string
  /** 平台类型名，取不到时排最后 */
  type?: string
  /** 日期（YYYY-MM-DD 或 ISO），同日按序号排 */
  date?: string
  /** 组内序号 */
  seq?: number
}

/**
 * 取字段在优先级列表中的位次，不在列表内的排在末尾
 * @param {string[]} order 优先级列表
 * @param {string} value 字段值
 * @returns {number} 位次
 */
function rank(order: string[], value?: string): number {
  const index = order.indexOf(value || '')
  return index === -1 ? order.length : index
}

/**
 * 平台状态优先，其次平台类型，再按日期倒序与序号升序
 * @param {TaskOrderFields} a 任务甲
 * @param {TaskOrderFields} b 任务乙
 * @returns {number} 比较结果
 */
export function compareTaskOrder(a: TaskOrderFields, b: TaskOrderFields): number {
  const byStatus = rank(STATUS_ORDER, a.status) - rank(STATUS_ORDER, b.status)
  if (byStatus !== 0) return byStatus
  const byType = rank(TYPE_ORDER, a.type) - rank(TYPE_ORDER, b.type)
  if (byType !== 0) return byType
  const byDate = (b.date || '').localeCompare(a.date || '')
  if (byDate !== 0) return byDate
  return (a.seq || 0) - (b.seq || 0)
}

// #endregion
