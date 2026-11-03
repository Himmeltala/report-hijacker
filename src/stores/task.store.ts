/*
 * @Author: zhengrenfu
 * @Date: 2026-07-14 22:59:18
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-07-14 12:14:04
 * @FilePath: \..\\src\\stores\\task.store.ts
 * @Description: 描述
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TaskItem, ValidationResult, CommentRuleMatch } from '@/types/task'

export const useTaskStore = defineStore('task', () => {
  // #region 状态

  const tasks = ref<TaskItem[]>([])
  const unrecognizedLines = ref<string[]>([])
  const validationResults = ref<(ValidationResult | null)[]>([])
  // 评论区检查结果与校验结果同样按索引对齐，存于 store 以便切换路由后保留
  const commentCheckResults = ref<(CommentRuleMatch[] | null)[]>([])
  const rawText = ref('')

  // #endregion

  // #region 操作方法

  function setTasks(newTasks: TaskItem[], unrecognized: string[]) {
    tasks.value = newTasks
    unrecognizedLines.value = unrecognized
    validationResults.value = []
    commentCheckResults.value = []
  }

  function clearTasks() {
    tasks.value = []
    unrecognizedLines.value = []
    validationResults.value = []
    commentCheckResults.value = []
    rawText.value = ''
  }

  function setValidationResults(results: (ValidationResult | null)[]) {
    validationResults.value = results
  }

  function setCommentCheckResults(results: (CommentRuleMatch[] | null)[]) {
    commentCheckResults.value = results
  }

  function removeTask(index: number) {
    tasks.value.splice(index, 1)
    // 同步移除校验与评论结果，保持与任务列表索引对齐
    if (index >= 0 && index < validationResults.value.length) {
      validationResults.value.splice(index, 1)
    }
    if (index >= 0 && index < commentCheckResults.value.length) {
      commentCheckResults.value.splice(index, 1)
    }
  }

  function updateTask(index: number, data: Partial<TaskItem>) {
    if (index >= 0 && index < tasks.value.length) {
      tasks.value[index] = { ...tasks.value[index], ...data }
    }
  }

  // #endregion

  // #region 返回值

  return {
    tasks,
    unrecognizedLines,
    validationResults,
    commentCheckResults,
    rawText,
    setTasks,
    clearTasks,
    setValidationResults,
    setCommentCheckResults,
    removeTask,
    updateTask,
  }

  // #endregion
})
