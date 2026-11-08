/*
 * @Author: zhengrenfu
 * @Date: 2026-11-08
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-08 19:30:00
 * @FilePath: \tests\services\taskValidation.test.ts
 * @Description: 任务审查编排单测：审查入参转换与审查结论判定
 */

import { describe, expect, it } from 'vitest'
import { isAiReviewPassed, toTaskToValidate } from '@/services/taskValidation'

describe('toTaskToValidate', () => {
  it('rawSeq 统一转为字符串，并保留可选 taskDate', () => {
    expect(
      toTaskToValidate({
        rawSeq: 12,
        rawProjectName: '项目',
        rawTitle: '标题',
        rawScore: '1',
        rawEstimatedHours: '2',
        rawRemark: '备注',
        rawUrl: 'https://x/1',
        taskDate: '2026-11-08',
      }),
    ).toEqual({
      rawSeq: '12',
      rawProjectName: '项目',
      rawTitle: '标题',
      rawScore: '1',
      rawEstimatedHours: '2',
      rawRemark: '备注',
      rawUrl: 'https://x/1',
      taskDate: '2026-11-08',
    })
  })

  it('不传 taskDate 时保持 undefined', () => {
    const result = toTaskToValidate({
      rawSeq: '1',
      rawProjectName: '',
      rawTitle: '',
      rawScore: '',
      rawEstimatedHours: '',
      rawRemark: '',
      rawUrl: '',
    })
    expect(result.taskDate).toBeUndefined()
  })
})

describe('isAiReviewPassed', () => {
  it('最后一行只有审查通过时判定通过', () => {
    expect(isAiReviewPassed('任务标题：x\n- 问题1\n\n审查通过')).toBe(true)
    expect(isAiReviewPassed('**审查通过。**')).toBe(true)
  })

  it('结论为空或最后一行不是审查通过时判定未通过', () => {
    expect(isAiReviewPassed(null)).toBe(false)
    expect(isAiReviewPassed('')).toBe(false)
    expect(isAiReviewPassed('审查通过\n- 问题1')).toBe(false)
  })
})
