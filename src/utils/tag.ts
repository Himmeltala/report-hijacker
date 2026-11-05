/*
 * @Author: zhengrenfu
 * @Date: 2026-08-03 10:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-05 10:45:00
 * @FilePath: \src\utils\tag.ts
 * @Description: Element Plus Tag 颜色映射工具函数
 */

// #region Tag 颜色映射

/**
 * 任务状态到 Tag 颜色类型的映射
 * @param {string} status 任务状态名称
 * @returns {string} Element Plus Tag type 值
 */
export function statusTagType(status: string): string {
  if (status === '待检查') return 'primary'
  if (status === '已实现') return 'success'
  if (status === '实现中') return 'warning'
  return 'info'
}

/**
 * 评价等级到 Tag 颜色类型的映射
 * @param {string} val 评价等级
 * @returns {string} Element Plus Tag type 值
 */
export function evaluationTagType(val: string): string {
  if (val === '合格') return 'primary'
  if (val === '好') return 'success'
  return 'danger'
}

/**
 * 任务类型到 Tag 颜色类型的映射
 * @param {string} type 任务类型名称（任务、缺陷、其他）
 * @returns {string} Element Plus Tag type 值
 */
export function taskTypeTagType(type: string): string {
  if (type === '任务') return 'primary'
  if (type === '缺陷') return 'danger'
  return 'warning'
}

/**
 * 优先级到 Tag 颜色类型的映射（API 英文值）
 * @param {string|null} priority 优先级名称（high、medium、low）
 * @returns {string} Element Plus Tag type 值
 */
export function priorityTagType(priority: string | null): string {
  if (priority === 'high') return 'danger'
  if (priority === 'medium') return 'warning'
  if (priority === 'low') return 'info'
  return 'info'
}

/**
 * 优先级到中文标签的映射
 * @param {string|null} priority 优先级名称（high、medium、low）
 * @returns {string} 中文标签
 */
export function priorityLabel(priority: string | null): string {
  if (priority === 'high') return '高'
  if (priority === 'medium') return '中'
  if (priority === 'low') return '低'
  return '-'
}

/**
 * 限时任务到 Tag 颜色类型的映射
 * @param {string|null} timeLimit 限时类型（today、temp）
 * @returns {string} Element Plus Tag type 值
 */
export function timeLimitTagType(timeLimit: string | null): string {
  if (timeLimit === 'today') return 'danger'
  if (timeLimit === 'temp') return 'warning'
  return 'info'
}

/**
 * 限时任务到中文标签的映射
 * @param {string|null} timeLimit 限时类型（today、temp）
 * @returns {string} 中文标签
 */
export function timeLimitLabel(timeLimit: string | null): string {
  if (timeLimit === 'today') return '今日'
  if (timeLimit === 'temp') return '临时'
  return '-'
}

// #endregion

// #region 常量与工具函数

// 标准分页大小列表
export const PAGE_SIZE_LIST = [15, 35, 55, 75, 95]

/**
 * 根据 baseUrl 构造任务详情链接
 * @param {number} id 任务 ID
 * @param {string} apiBaseUrl API 基础地址
 * @returns {string} 完整任务链接
 */
export function workPackageUrl(id: number, apiBaseUrl: string): string {
  const base = (apiBaseUrl || 'https://xmgl.cdrunnet.com').trim().replace(/\/+$/, '')
  return `${base}/work_packages/${id}`
}

/**
 * 格式化 ISO 时间字符串为可读格式
 * @param {string} iso ISO 8601 时间字符串
 */
export function formatTime(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// #endregion
