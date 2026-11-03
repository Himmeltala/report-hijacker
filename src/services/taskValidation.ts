/*
 * @Author: zhengrenfu
 * @Date: 2026-08-04 23:59:29
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04 12:14:04
 * @FilePath: \src\services\taskValidation.ts
 * @Description: 任务校验服务层，封装批量校验与评论区检查的编排逻辑
 */

import type { ValidationResult, CommentRuleMatch } from '@/types/task'
import type { CheckRule, CommentRule, MatchMode } from '@/types/config'
import { validateTask, checkComments } from '@/utils/validator'
import { matchTextRules } from '@/services/validationRules'
import { aiReviewTask } from '@/utils/aiReview'

// #region 类型定义

// 单条待校验任务的输入描述
export interface TaskToValidate {
  rawSeq: string
  rawProjectName: string
  rawTitle: string
  rawScore: string
  rawEstimatedHours: string
  rawRemark: string
  rawUrl: string
  taskDate?: string
}

// 校验配置项
export interface ValidateConfig {
  cookie: string
  handlerName: string
  checkRules: CheckRule[]
  boundaryRules: CommentRule[]
  boundaryMatchMode: MatchMode
  commentRules: CommentRule[]
  commentMatchMode: MatchMode
  /** 启用 AI 审查（可选，未传时不执行，保持既有流程不变） */
  aiEnabled?: boolean
}

// 单条任务的校验结果
export interface TaskValidateOutcome {
  /** 原数组索引，批量中止时后续索引缺失 */
  index: number
  /** 基础校验结果，校验异常时为 null */
  result: ValidationResult | null
  /** 评论区匹配结果，未启用规则或无任务 ID 时为 null */
  commentMatches: CommentRuleMatch[] | null
  /** AI 审查结论，未启用 AI 审查或无任务 ID 时为 null */
  aiConclusion: string | null
  /** AI 审查异常信息 */
  aiError?: string
  /** 校验异常信息 */
  error?: Error
}

// 批量校验选项
export interface ValidateBatchOptions {
  /** 外部中止信号 */
  signal?: { aborted: boolean }
  /** 每条任务开始时回调，用于输出进度日志 */
  onTaskStart?: (index: number, total: number, task: TaskToValidate) => void
  /** 每条任务完成时立即回调，用于逐条输出结果日志 */
  onTaskComplete?: (outcome: TaskValidateOutcome) => void
}

// #endregion

// #region 内部函数

/**
 * 从 activities API 响应中提取评论区纯文本
 * @param {any} activities 原始 API 响应
 * @returns {string} 拼接后的评论区文本
 */
function extractCommentText(activities: any): string {
  const elements = activities._embedded?.elements || []
  const comments = elements.filter((el: any) => el._type === 'Activity::Comment' && el.comment?.raw?.trim())
  return comments.map((c: any) => c.comment.raw).join('\n---\n')
}

// #endregion

// #region 批量校验

/**
 * 批量校验任务，按序逐条执行，支持中止信号与进度回调
 * @param {TaskToValidate[]} tasks 待校验任务列表
 * @param {ValidateConfig} config 校验配置
 * @param {ValidateBatchOptions} options 选项（中止信号、进度回调）
 * @returns {Promise<TaskValidateOutcome[]>} 与 tasks 等长的校验结果列表
 */
export async function validateBatch(
  tasks: TaskToValidate[],
  config: ValidateConfig,
  options: ValidateBatchOptions = {},
): Promise<TaskValidateOutcome[]> {
  const { signal, onTaskStart, onTaskComplete } = options
  const total = tasks.length

  // 循环外预处理：评论区规则过滤与边界规则深拷贝只需一次
  const activeCommentRules = config.commentRules.filter((r) => r.enabled && r.pattern)
  const commentMatchMode = config.commentMatchMode
  const boundaryRules = JSON.parse(JSON.stringify(config.boundaryRules))

  const outcomes: TaskValidateOutcome[] = []
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) break

    const task = tasks[i]
    onTaskStart?.(i, total, task)

    try {
      const result = await validateTask(
        task.rawSeq,
        task.rawProjectName,
        task.rawTitle,
        task.rawScore,
        task.rawEstimatedHours,
        task.rawRemark,
        task.rawUrl,
        config.cookie,
        config.handlerName,
        config.checkRules || [],
        boundaryRules,
        config.boundaryMatchMode,
        task.taskDate,
      )

      let commentMatches: CommentRuleMatch[] | null = null
      // 只对规则选中的任务类型执行，未选类型表示对全部类型生效
      const taskType = result.remote?._embedded?.type?.name || ''
      const applicableRules = activeCommentRules.filter((r) => !r.types?.length || r.types.includes(taskType))
      if (applicableRules.length > 0 && result.serTaskId) {
        try {
          const activities = await checkComments(result.serTaskId, config.cookie)
          commentMatches = matchTextRules(extractCommentText(activities), applicableRules, commentMatchMode)
        } catch {
          // 评论区检查异常不影响校验主流程
          commentMatches = null
        }
      }

      // AI 审查：仅启用时执行，异常只记录不中断校验主流程
      let aiConclusion: string | null = null
      let aiError: string | undefined
      if (config.aiEnabled && result.serTaskId) {
        try {
          aiConclusion = (await aiReviewTask(result.serTaskId, config.cookie)).conclusion
        } catch (e: any) {
          aiError = e?.message || 'AI 审查失败'
        }
      }

      const outcome: TaskValidateOutcome = { index: i, result, commentMatches, aiConclusion, aiError }
      outcomes.push(outcome)
      onTaskComplete?.(outcome)
    } catch (e: any) {
      const outcome: TaskValidateOutcome = {
        index: i,
        result: null,
        commentMatches: null,
        aiConclusion: null,
        error: e,
      }
      outcomes.push(outcome)
      onTaskComplete?.(outcome)
    }
  }

  return outcomes
}

// #endregion
