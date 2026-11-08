<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14 00:01:53
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 14:21:53
 * @FilePath: \src\views\ExportTask\index.vue
 * @Description: 导出任务页面 - 解析文本、获取平台数据并导出 Excel
-->

<template>
  <div class="page-export-task">
    <div class="page-toolbar">
      <div class="toolbar-actions">
        <el-button type="primary" @click="handleParse" :disabled="!rawText.trim()">
          <el-icon><Document /></el-icon>解析
        </el-button>
        <el-button @click="handleFetchData" :disabled="tasks.length === 0" :loading="isFetching">
          <el-icon><Select /></el-icon>获取平台数据
        </el-button>
        <el-divider direction="vertical" />
        <el-button type="primary" @click="handleExport" :disabled="tasks.length === 0" :loading="isExporting">
          <el-icon><Download /></el-icon>导出
        </el-button>
        <el-divider direction="vertical" />
        <el-button @click="clearAll">
          <el-icon><Delete /></el-icon>清空
        </el-button>
      </div>
      <div class="toolbar-right">
        <span class="stats-text">
          任务数: <strong>{{ tasks.length }}</strong>
        </span>
      </div>
    </div>

    <div v-if="tasks.length" class="stats-bar">
      <span class="stat-item"
        >管理平台自评时长 <strong>{{ stats.totalSelfHours }}</strong
        >h</span
      >
      <span class="stat-item"
        >管理平台预估时长 <strong>{{ stats.totalEstHours }}</strong
        >h</span
      >
      <span class="stat-item"
        >任务链接预估时长 <strong>{{ stats.totalScore }}</strong
        >h</span
      >
      <el-divider direction="vertical" />
      <span class="stat-item"
        >好 <strong>{{ stats.evaluationGood }}</strong></span
      >
      <span class="stat-item"
        >合格 <strong>{{ stats.evaluationPass }}</strong></span
      >
      <span class="stat-item"
        >其他 <strong>{{ stats.evaluationOther }}</strong></span
      >
    </div>

    <ParseInput v-model:text="rawText" :unrecognized-lines="unrecognizedLines" />

    <TaskTable
      :tasks="tasks"
      :detailResults="detailResults"
      :unrecognizedLines="unrecognizedLines"
      @remove="handleRemoveTask"
      @update="handleUpdateTask"
      @detail="showDetail"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Document, Select, Download, Delete } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useTaskStore } from '@/stores/task.store'
import { useLogStore } from '@/stores/log.store'
import { useModal } from '@/composables/useModal'
import { parseTaskText } from '@/utils/parser'
import { getErrorMessage } from '@/utils/error'
import { reviewBatch, toTaskToValidate, type TaskToValidate } from '@/services/taskValidation'
import { computeTaskStats } from '@/services/taskStats'
import type { TaskDetailResult, TaskItem } from '@/types/task'

import ParseInput from '@/components/ParseInput.vue'
import TaskTable from '@/views/ExportTask/components/TaskTable.vue'

const store = useSettingsStore()
const taskStore = useTaskStore()
const logStore = useLogStore()

const detailModal = useModal<{ result: TaskDetailResult | null; aiConclusion?: string | null }>({
  component: () => import('@/modals/TaskDetailModal.vue'),
  autoCloseEvents: ['close'],
})

const isFetching = ref(false)
const isExporting = ref(false)
const rawText = computed({
  get: () => taskStore.rawText,
  set: (v) => {
    taskStore.rawText = v
  },
})

const tasks = computed(() => taskStore.tasks)
const unrecognizedLines = computed(() => taskStore.unrecognizedLines)
const detailResults = computed(() => taskStore.detailResults)

const stats = computed(() =>
  computeTaskStats(
    tasks.value,
    detailResults.value.map((r) => r?.remote),
  ),
)

function showDetail(index: number) {
  detailModal.open({
    result: taskStore.detailResults[index] ?? null,
  })
}

function handleParse() {
  if (!rawText.value.trim()) return
  const regexStr = store.config.taskRegex
  if (!regexStr) {
    logStore.addLog('warning', '请先在设置中填写导出解析正则')
    return
  }
  const { tasks: parsed, unrecognized } = parseTaskText(rawText.value, regexStr)
  taskStore.setTasks(parsed, unrecognized)

  logStore.addLog('info', `解析完成: ${parsed.length} 条任务, ${unrecognized.length} 行未识别`)

  if (unrecognized.length > 0) {
    logStore.addLog('warning', `${unrecognized.length} 行格式无法识别`)
  } else if (parsed.length > 0) {
    logStore.addLog('success', `成功解析 ${parsed.length} 条任务`)
  } else {
    logStore.addLog('info', '未解析到任何任务，请检查文本格式')
  }
}

async function handleFetchData() {
  if (tasks.value.length === 0) return
  const { cookie, handlerName } = store.config
  if (!cookie) {
    logStore.addLog('warning', '请先在设置中填写 Cookie')
    return
  }

  isFetching.value = true
  taskStore.setDetailResults([])
  logStore.addLog('info', `开始获取平台数据 ${tasks.value.length} 条任务...`)

  const ttv: TaskToValidate[] = tasks.value.map(toTaskToValidate)

  try {
    // 按原索引写入结果与日志
    const outcomes = await reviewBatch(
      ttv,
      { cookie, handlerName },
      {
        onTaskStart: (i, total, task) => {
          logStore.addLog('info', `[${i + 1}/${total}] ${task.rawProjectName} - ${task.rawTitle}`)
        },
      },
    )

    let fetched = 0
    for (const o of outcomes) {
      if (o.error) {
        logStore.addLog('error', `[${o.index + 1}] 获取失败: ${o.error.message}`)
        continue
      }
      taskStore.detailResults[o.index] = o.result
      if (o.result?.serError) {
        logStore.addLog('error', `[${o.index + 1}] ${o.result.serError}`)
        continue
      }
      fetched++
      logStore.addLog('success', `[${o.index + 1}] 已获取: ${ttv[o.index].rawProjectName}`)
    }
    logStore.addLog('success', `获取平台数据完成: ${fetched}/${ttv.length} 条`)
  } finally {
    isFetching.value = false
  }
}

function generateDefaultFilename(): string {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  // 以周一为一周起点计算当月第几周
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const weekNum = Math.floor((now.getDate() - 1 + mondayOffset) / 7) + 1
  return `${store.config.handlerName || '周报'}-${now.getMonth() + 1}月第${weekNum}周周报.xlsx`
}

async function handleExport() {
  if (tasks.value.length === 0) return
  const defaultName = generateDefaultFilename()
  const targetPath = await window.electron?.saveFile({
    defaultName,
    filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }],
  })
  if (!targetPath) return

  const templatePath = store.config.templatePath
  const { handlerName, cookie } = store.config
  isExporting.value = true
  logStore.addLog('info', '正在导出...')
  try {
    const result = await window.electron.fillExcelTemplate({
      tasks: JSON.parse(JSON.stringify(tasks.value)),
      templatePath: templatePath || undefined,
      targetPath,
      handlerName,
      cookie,
    })
    if (result.success) {
      logStore.addLog('success', `导出成功: ${result.filePath}`)
    } else {
      logStore.addLog('error', `导出失败: ${result.error}`)
    }
  } catch (e) {
    logStore.addLog('error', `导出异常: ${getErrorMessage(e)}`)
  } finally {
    isExporting.value = false
  }
}

/**
 * 编辑单条任务后重新获取平台数据，保证展示的字段与编辑后的链接一致
 * @param {number} index 任务索引
 */
async function fetchSingleDetail(index: number) {
  const task = tasks.value[index]
  if (!task || !task.rawUrl) return
  const { cookie, handlerName } = store.config
  if (!cookie) return

  const outcomes = await reviewBatch([toTaskToValidate(task)], { cookie, handlerName })
  const o = outcomes[0]
  if (!o) return
  taskStore.detailResults[index] = o.error ? null : o.result
}

function handleUpdateTask(index: number, data: Partial<TaskItem>) {
  taskStore.updateTask(index, data)
  logStore.addLog('info', `更新任务 #${index + 1}`)
  // 编辑后重新获取该条任务的平台数据，避免展示字段与链接脱节
  fetchSingleDetail(index)
}

function handleRemoveTask(index: number) {
  // 删除任务时同步移除其平台数据，保持索引对齐
  taskStore.removeTask(index)
  logStore.addLog('info', `删除任务 #${index + 1}`)
}

function clearAll() {
  taskStore.clearTasks()
  // 仅清本页数据，日志面板为全局共享，不清空其他页面的操作记录
  logStore.addLog('info', '已清空所有数据')
}
</script>

<style scoped>
.page-export-task {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.page-toolbar {
  display: flex;
  align-items: center;
  gap: var(--app-gap-toolbar);
  padding: var(--app-padding-toolbar);
  background: var(--el-bg-color-overlay);
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: var(--app-gap-toolbar);
}
.toolbar-right {
  margin-left: auto;
  padding-right: 4px;
}
.stats-text {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}
.stats-text strong {
  color: var(--el-color-primary);
}
.stats-bar {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  padding: var(--app-space-1) var(--app-space-3);
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
}
.stat-item strong {
  color: var(--el-color-primary);
  margin: 0 2px;
}
</style>
