/*
 * @Author: zhengrenfu
 * @Date: 2026-07-16 10:39:45
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 14:21:53
 * @FilePath: \src\types\task.ts
 * @Description: 任务领域模型类型定义
 */

import type { ReadonlyRawWorkPackage } from '@/types/remote'

// #region 任务数据

/** 解析后的一条任务，字段均来自被拆分的文本块，统一使用 raw 前缀标注文本来源 */
export interface TaskItem {
  lineNumber: number
  rawSeq: string
  rawEstimatedHours: string
  rawProjectName: string
  /** 任务标题（含备注） */
  rawTitle: string
  /** 处理人（从标题或备注末尾提取） */
  rawHandler: string
  /** 备注（第一个【】内的内容） */
  rawRemark: string
  rawUrl: string
  /** 工时或分数 */
  rawScore: string
  rawText: string
}

// #endregion

// #region 任务详情

/** 从平台拉取的任务详情，ser 前缀为服务与平台侧字段 */
export interface TaskDetailResult {
  serTaskId: string
  /** 远程原始数据，只读，平台字段原封不动 */
  remote?: ReadonlyRawWorkPackage
  /** 取数或请求异常信息 */
  serError?: string
}

// #endregion
