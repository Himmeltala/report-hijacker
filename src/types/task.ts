/*
 * @Author: zhengrenfu
 * @Date: 2026-07-16 10:39:45
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-08 17:05:00
 * @FilePath: \src\types\task.ts
 * @Description: 任务领域模型类型定义
 */

import type { ReadonlyRawWorkPackage } from '@/types/remote'

// #region 任务数据

/**
 * 文本解析出的任务公共字段
 * raw 前缀标注字段来自被拆分的文本块，各任务模型共用这一份声明，避免字段名与含义分叉
 */
export interface RawTaskFields {
  // 组内序号，解析阶段为字符串，落库后为数字
  rawSeq: string | number
  rawProjectName: string
  // 任务标题（含备注）
  rawTitle: string
  // 工时或分数
  rawScore: string
  rawEstimatedHours: string
  // 备注（第一个【】内的内容）
  rawRemark: string
  rawUrl: string
}

/** 解析后的一条任务，字段均来自被拆分的文本块 */
export interface TaskItem extends RawTaskFields {
  lineNumber: number
  // 解析阶段序号统一为字符串
  rawSeq: string
  // 处理人（从标题或备注末尾提取）
  rawHandler: string
  rawText: string
}

/** Excel 导出任务行：只需文本字段，平台详情由主进程按任务链接补全 */
export type ExcelTaskRow = Pick<
  RawTaskFields,
  'rawUrl' | 'rawProjectName' | 'rawTitle' | 'rawScore' | 'rawEstimatedHours'
> & {
  // 备注列不是所有页面都提供，缺省按空值填充
  rawRemark?: string
}

// #endregion

// #region 任务详情

/** 从平台拉取的任务详情，ser 前缀为服务与平台侧字段 */
export interface TaskDetailResult {
  serTaskId: string
  // 远程原始数据，只读，平台字段原封不动
  remote?: ReadonlyRawWorkPackage
  // 取数或请求异常信息
  serError?: string
}

// #endregion
