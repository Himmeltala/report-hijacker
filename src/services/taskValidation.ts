/*
 * @Author: zhengrenfu
 * @Date: 2026-08-04 23:59:29
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-06 12:08:00
 * @FilePath: \src\services\taskValidation.ts
 * @Description: 任务取数与 AI 审查编排服务
 */

import { AI_SETTING_KEYS } from '@/types/ai'
import type { RawTaskFields, TaskDetailResult } from '@/types/task'
import { fetchTaskDetail, checkComments } from '@/utils/taskDetail'
import { convertIso8601ToHours } from '@/utils/parser'
import { getErrorMessage } from '@/utils/error'
import {
  aiChat,
  buildToolDefs,
  fillPrompt,
  getAiSetting,
  isToolsUnsupportedError,
  loadAuxPromptTools,
  runAuxTool,
  runToolLoop,
  toPlainText,
  MAX_CONTEXT_CHARS,
} from '@/services/ai'

// #region 类型定义

/** AI 审查入参，rawSeq 在进入审查前统一为字符串 */
export interface TaskToValidate extends RawTaskFields {
  rawSeq: string
  // 文本中的任务日期，平台无起止日期时兜底
  taskDate?: string
}

// 页面任务对象转换为审查入参，字段集中在这里对齐
export interface TaskToValidateSource extends RawTaskFields {
  rawSeq: string | number
  taskDate?: string
}

/**
 * 把页面上的任务对象转换为审查入参
 * @param {TaskToValidateSource} task 页面任务对象
 * @returns {TaskToValidate} 审查入参，rawSeq 统一为字符串
 */
export function toTaskToValidate(task: TaskToValidateSource): TaskToValidate {
  return {
    rawSeq: String(task.rawSeq),
    rawProjectName: task.rawProjectName,
    rawTitle: task.rawTitle,
    rawScore: task.rawScore,
    rawEstimatedHours: task.rawEstimatedHours,
    rawRemark: task.rawRemark,
    rawUrl: task.rawUrl,
    taskDate: task.taskDate,
  }
}

export interface ValidateConfig {
  cookie: string
  handlerName: string
  // 设置中的所属部门，AI 审查比对用
  departmentName?: string
  // 是否执行 AI 审查（只拉取平台数据时省略）
  aiEnabled?: boolean
}

export interface TaskReviewOutcome {
  // 原数组索引，批量中止时后续索引缺失
  index: number
  // 平台任务详情，取数异常时为 null
  result: TaskDetailResult | null
  // AI 审查结论，未启用 AI 审查时为 null
  aiConclusion: string | null
  // AI 审查实际发送的提示词，未执行时为 undefined
  aiPrompt?: string
  // 推理模型的思考过程，非推理模型为空
  aiReasoning?: string
  // AI 审查异常信息
  aiError?: string
  // 取数异常信息
  error?: Error
}

export interface ValidateBatchOptions {
  // 外部中止信号
  signal?: { aborted: boolean }
  // 每条任务开始时回调，用于输出进度日志
  onTaskStart?: (index: number, total: number, task: TaskToValidate) => void
  // 每条任务完成时立即回调，用于逐条输出结果日志
  onTaskComplete?: (outcome: TaskReviewOutcome) => void
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

// 任务审查模块提示词设置键（提示词按模块独立配置，连接配置统一全局）
const TASK_REVIEW_PROMPT_KEY = AI_SETTING_KEYS.taskReviewPrompt

// 工具模式下的附加说明：流程图必须由辅助提示词工具生成，避免模型自己直接编
const TOOL_MODE_INSTRUCTION = [
  '当「怎么做」缺少流程图时，调用可用的辅助提示词工具生成 Mermaid 源码，不要自己直接编流程图。',
  '把工具返回的 Mermaid 源码原样放进「建议：」末尾，作为 ```mermaid 围栏代码块。',
  '工具结果返回后直接输出最终审查结论，不要重复调用同一个工具。',
].join('\n')

// 今天日期，YYYY-MM-DD
function todayText(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 时长字段转小时文本，空值返回空字符串
function hoursText(raw: any): string {
  if (raw === undefined || raw === null || raw === '') return ''
  return String(convertIso8601ToHours(String(raw)))
}

/**
 * 平台任务日期区间转文本，供 AI 判断今天是否落在区间内
 * @param {any} remote 平台任务原始数据
 * @returns {string} 区间文本，起止日期都为空时返回空字符串
 */
function dateRangeText(remote: any): string {
  const start = remote?.startDate ? String(remote.startDate) : ''
  const due = remote?.dueDate ? String(remote.dueDate) : ''
  if (start && due) return `${start} 至 ${due}`
  if (start) return `${start} 起（结束日期未填）`
  if (due) return `截至 ${due}（开始日期未填）`
  return ''
}

/**
 * 对单条任务执行 AI 审查：读取模块提示词模板，任务上下文替换占位符后调用 AI 通道；
 * 配置了辅助提示词时按工具模式多轮请求，由模型决定何时调用工具补流程图
 * @param {TaskDetailResult} result 任务详情（remote 含平台原始数据）
 * @param {string | null} commentText 评论区文本，null 表示取数异常
 * @param {{ handlerName?: string; departmentName?: string; taskDate?: string }} expected 设置中的预期处理人、所属部门与文本任务日期（平台无起止日期时兜底）
 * @returns {Promise<{ conclusion: string; prompt: string; reasoning: string }>} 审查结论、发送的提示词与思考过程
 */
async function runAiReview(
  result: TaskDetailResult,
  commentText: string | null,
  expected: { handlerName?: string; departmentName?: string; taskDate?: string },
): Promise<{ conclusion: string; prompt: string; reasoning: string }> {
  const template = await getAiSetting(TASK_REVIEW_PROMPT_KEY)
  if (!template.trim()) throw new Error('未配置审查提示词')
  const remote = result.remote
  const embedded = remote?._embedded || {}
  const ctx = {
    title: remote?.subject || '',
    status: embedded.status?.name || remote?._links?.status?.title || '',
    type: embedded.type?.name || remote?._links?.type?.title || '',
    // 日期用平台起止日期组成区间，平台未填时退回文本里的任务日期
    date: dateRangeText(remote) || expected.taskDate || '',
    today: todayText(),
    responsible: embedded.responsible?.name || remote?._links?.responsible?.title || '',
    expectedHandler: expected.handlerName || '',
    // 所属部门平台只在 _links 里返回标题，顶层 customField106 为空
    department: remote?._links?.customField106?.title || '',
    expectedDepartment: expected.departmentName || '',
    selfHours: hoursText(remote?.estimatedTime),
    estimateHours: remote?.customField105 == null ? '' : String(remote.customField105),
    description: toPlainText(remote?.description?.raw || '').slice(0, MAX_CONTEXT_CHARS),
    comments: toPlainText(commentText || '').slice(0, MAX_CONTEXT_CHARS),
  }
  const prompt = fillPrompt(template, ctx)
  const auxTools = await loadAuxPromptTools()
  // 没有配置辅助提示词时仍按单轮审查
  if (!auxTools.length) {
    const { text, reasoning } = await aiChat({ prompt })
    return { conclusion: text, prompt, reasoning }
  }
  const toolMap = new Map(auxTools.map((tool) => [tool.name, tool]))
  try {
    const { conclusion, reasoning } = await runToolLoop({
      prompt,
      tools: buildToolDefs(auxTools),
      instruction: TOOL_MODE_INSTRUCTION,
      execute: (call) => runAuxTool(toolMap, call),
    })
    return { conclusion, prompt, reasoning }
  } catch (e) {
    // 接口不支持工具调用时退回单轮审查，保持原有行为
    if (!isToolsUnsupportedError(e)) throw e
    const { text, reasoning } = await aiChat({ prompt })
    return { conclusion: text, prompt, reasoning }
  }
}

// #endregion

// #region 批量处理

/**
 * 判断 AI 审查结论是否为通过
 *
 * 结论首行是任务标题，因此按最后一行是否只有「审查通过」判断
 * @param {string | null | undefined} conclusion 审查结论
 * @returns {boolean} 结论为「审查通过」时返回 true
 */
export function isAiReviewPassed(conclusion?: string | null): boolean {
  if (!conclusion) return false
  const lines = conclusion
    .split('\n')
    .map((line) => line.replace(/[\s。．.!！*_`#>]/g, ''))
    .filter(Boolean)
  return lines[lines.length - 1] === '审查通过'
}

/**
 * 批量处理任务：逐条拉取平台详情，启用 AI 审查时再生成审查结论
 * @param {TaskToValidate[]} tasks 待处理任务列表
 * @param {ValidateConfig} config 取数与审查配置
 * @param {ValidateBatchOptions} options 选项（中止信号、进度回调）
 * @returns {Promise<TaskReviewOutcome[]>} 与 tasks 等长的处理结果列表
 */
export async function reviewBatch(
  tasks: TaskToValidate[],
  config: ValidateConfig,
  options: ValidateBatchOptions = {},
): Promise<TaskReviewOutcome[]> {
  const { signal, onTaskStart, onTaskComplete } = options
  const total = tasks.length
  const outcomes: TaskReviewOutcome[] = []

  for (let i = 0; i < total; i++) {
    if (signal?.aborted) break
    const task = tasks[i]
    onTaskStart?.(i, total, task)

    let result: TaskDetailResult | null = null
    let aiConclusion: string | null = null
    let aiPrompt: string | undefined
    let aiReasoning: string | undefined
    let aiError: string | undefined
    let error: Error | undefined

    try {
      result = await fetchTaskDetail(task.rawUrl, config.cookie)

      // AI 审查：取到平台详情后执行，异常只记录不中断批量流程
      if (config.aiEnabled && result.serTaskId && result.remote) {
        let commentText: string | null = null
        try {
          const activities = await checkComments(result.serTaskId, config.cookie)
          commentText = extractCommentText(activities)
        } catch {
          commentText = null
        }
        try {
          const review = await runAiReview(result, commentText, {
            handlerName: config.handlerName,
            departmentName: config.departmentName,
            taskDate: task.taskDate,
          })
          aiConclusion = review.conclusion
          aiPrompt = review.prompt
          aiReasoning = review.reasoning
        } catch (e) {
          aiError = getErrorMessage(e, 'AI 审查失败')
        }
      }
    } catch (e) {
      error = e as Error
    }

    const outcome: TaskReviewOutcome = { index: i, result, aiConclusion, aiPrompt, aiReasoning, aiError, error }
    outcomes.push(outcome)
    onTaskComplete?.(outcome)
  }

  return outcomes
}

// #endregion
