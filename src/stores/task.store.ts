/*
 * @Author: zhengrenfu
 * @Date: 2026-07-14 22:59:18
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 14:21:53
 * @FilePath: \src\stores\task.store.ts
 * @Description: 解析任务与平台详情结果的状态存储
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TaskItem, TaskDetailResult } from '@/types/task'

export const useTaskStore = defineStore('task', () => {
  // #region 状态

  const tasks = ref<TaskItem[]>([])
  const unrecognizedLines = ref<string[]>([])
  // 平台详情按任务索引对齐，存于 store 以便切换路由后保留
  const detailResults = ref<(TaskDetailResult | null)[]>([])
  const rawText = ref('')

  // #endregion

  // #region 操作方法

  function setTasks(newTasks: TaskItem[], unrecognized: string[]) {
    tasks.value = newTasks
    unrecognizedLines.value = unrecognized
    detailResults.value = []
  }

  function clearTasks() {
    tasks.value = []
    unrecognizedLines.value = []
    detailResults.value = []
    rawText.value = ''
  }

  function setDetailResults(results: (TaskDetailResult | null)[]) {
    detailResults.value = results
  }

  function removeTask(index: number) {
    tasks.value.splice(index, 1)
    // 同步移除平台详情，保持与任务列表索引对齐
    if (index >= 0 && index < detailResults.value.length) {
      detailResults.value.splice(index, 1)
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
    detailResults,
    rawText,
    setTasks,
    clearTasks,
    setDetailResults,
    removeTask,
    updateTask,
  }

  // #endregion
})
