/*
 * @Author: zhengrenfu
 * @Date: 2026-07-14 00:11:48
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04 12:14:04
 * @FilePath: \src\utils\validator.ts
 * @Description: 任务管理校验函数（IPC 透传层）
 */

import type { ValidationResult } from '@/types/task'
import type { ActivitiesResponse } from '@/types/api'
import type { CheckRule, CommentRule, MatchMode } from '@/types/config'
import type { ValidateTaskParams } from '@/types/ipc'

// #region 任务校验

/**
 * 校验单个任务（调用主进程校验接口）
 * @param {string} rawProjectName 期望项目名称
 * @param {string} rawTitle 期望任务标题
 * @param {string} rawScore 期望工时分数
 * @param {string} rawUrl 任务链接
 * @param {string} cookie 登录 Cookie
 * @param {string} handlerName 处理人
 * @param {CheckRule[]} checkRules 校验规则列表
 * @param {CommentRule[]} boundaryRules 边界规则列表
 * @param {MatchMode} boundaryMatchMode 边界匹配模式
 * @param {string} taskDate 任务日期（可选）
 * @returns {Promise<ValidationResult>} 校验结果
 */
export async function validateTask(
  rawSeq: string,
  rawProjectName: string,
  rawTitle: string,
  rawScore: string,
  rawEstimatedHours: string,
  rawRemark: string,
  rawUrl: string,
  cookie: string,
  handlerName: string,
  checkRules: CheckRule[],
  boundaryRules: CommentRule[],
  boundaryMatchMode: MatchMode,
  taskDate?: string,
): Promise<ValidationResult> {
  const params: ValidateTaskParams = {
    rawSeq,
    rawProjectName,
    rawTitle,
    rawScore,
    rawEstimatedHours,
    rawRemark,
    rawUrl,
    cookie,
    handlerName,
    // 深拷贝避免 Vue reactive Proxy 无法通过 IPC 结构化克隆
    checkRules: JSON.parse(JSON.stringify(checkRules || [])),
    boundaryRules: JSON.parse(JSON.stringify(boundaryRules || [])),
    boundaryMatchMode,
    taskDate,
  }
  return window.electron.validateTask(params)
}

// #endregion

// #region 评论区检查

/**
 * 获取任务评论区原始数据（透传 API 响应）
 * 消费端直接导航返回值的 _embedded.elements[]._type / comment.raw
 * @param {string} taskId 任务 ID
 * @param {string} cookie 登录 Cookie
 * @returns {Promise<ActivitiesResponse>} 活动列表响应
 */
export async function checkComments(taskId: string, cookie: string): Promise<ActivitiesResponse> {
  return window.electron.checkComments({ taskId, cookie })
}

// #endregion
