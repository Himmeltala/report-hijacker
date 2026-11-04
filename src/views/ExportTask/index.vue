<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14 00:01:53
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04 12:14:04
 * @FilePath: \src\views\ExportTask\index.vue
 * @Description: 描述
-->

<template>
  <div class="page-export-task">
    <div class="page-toolbar">
      <div class="toolbar-actions">
        <el-button type="primary" @click="handleParse" :disabled="!rawText.trim()">
          <el-icon><Document /></el-icon>解析
        </el-button>
        <el-button @click="handleValidate" :disabled="tasks.length === 0" :loading="isValidating">
          <el-icon><Select /></el-icon>校验
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
        >好 <strong>{{ stats.evalGood }}</strong></span
      >
      <span class="stat-item"
        >合格 <strong>{{ stats.evalPass }}</strong></span
      >
      <span class="stat-item"
        >其他 <strong>{{ stats.evalOther }}</strong></span
      >
    </div>

    <ParseInput v-model:text="rawText" :unrecognized-lines="unrecognizedLines" />

    <TaskTable
      :tasks="tasks"
      :validationResults="validationResults"
      :unrecognizedLines="unrecognizedLines"
      @remove="handleRemoveTask"
      @update="handleUpdateTask"
      @detail="showDetail"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { Document, Select, Download, Delete } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useTaskStore } from '@/stores/task.store'
import { useLogStore } from '@/stores/log.store'
import { useModal } from '@/composables/useModal'
import { parseTaskText } from '@/utils/parser'
import { validateBatch, type TaskToValidate } from '@/services/taskValidation'
import { computeTaskStats } from '@/services/taskStats'
import { isRulesPassed, failedRuleLabels } from '@/services/validationRules'
import type { TaskItem } from '@/types/task'

import ParseInput from '@/components/ParseInput.vue'
import TaskTable from '@/views/ExportTask/components/TaskTable.vue'

const store = useSettingsStore()
const taskStore = useTaskStore()
const logStore = useLogStore()

const detailModal = useModal({
  component: () => import('@/modals/TaskDetailModal.vue'),
  autoCloseEvents: ['close'],
})

const isValidating = ref(false)
const isExporting = ref(false)
const rawText = computed({
  get: () => taskStore.rawText,
  set: (v) => {
    taskStore.rawText = v
  },
})

const tasks = computed(() => taskStore.tasks)
const unrecognizedLines = computed(() => taskStore.unrecognizedLines)
const validationResults = computed(() => taskStore.validationResults)

const stats = computed(() =>
  computeTaskStats(
    tasks.value,
    validationResults.value.map((r) => r?.remote),
  ),
)

// 评论区检查结果存于任务 store，切换路由后保留
const { commentCheckResults } = storeToRefs(taskStore)

function showDetail(index: number) {
  detailModal.open({
    result: taskStore.validationResults[index] ?? null,
    commentResult: commentCheckResults.value[index] ?? null,
    commentMatchMode: store.config.commentMatchMode || 'all',
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
  commentCheckResults.value = []

  logStore.addLog('info', `解析完成: ${parsed.length} 条任务, ${unrecognized.length} 行未识别`)

  if (unrecognized.length > 0) {
    logStore.addLog('warning', `${unrecognized.length} 行格式无法识别`)
  } else if (parsed.length > 0) {
    logStore.addLog('success', `成功解析 ${parsed.length} 条任务`)
  } else {
    logStore.addLog('info', '未解析到任何任务，请检查文本格式')
  }
}

async function handleValidate() {
  if (tasks.value.length === 0) return
  const { cookie, handlerName, checkRules, boundaryRules, boundaryMatchMode, commentRules, commentMatchMode } =
    store.config
  if (!cookie) {
    logStore.addLog('warning', '请先在设置中填写 Cookie')
    return
  }

  isValidating.value = true
  taskStore.setValidationResults([])
  commentCheckResults.value = []
  logStore.addLog('info', `开始校验 ${tasks.value.length} 条任务...`)

  const ttv: TaskToValidate[] = tasks.value.map((t) => ({
    rawSeq: t.rawSeq,
    rawProjectName: t.rawProjectName,
    rawTitle: t.rawTitle,
    rawScore: t.rawScore,
    rawEstimatedHours: t.rawEstimatedHours,
    rawRemark: t.rawRemark,
    rawUrl: t.rawUrl,
  }))

  try {
    // 按原索引写入结果与日志，出错槽位保留错误结果保证与评论结果索引对齐
    const outcomes = await validateBatch(
      ttv,
      {
        cookie,
        handlerName,
        checkRules: checkRules || [],
        boundaryRules,
        boundaryMatchMode,
        commentRules: commentRules || [],
        commentMatchMode: commentMatchMode || 'all',
      },
      {
        onTaskStart: (i, total, task) => {
          logStore.addLog('info', `[${i + 1}/${total}] ${task.rawProjectName} - ${task.rawTitle}`)
        },
      },
    )

    let validCount = 0
    for (const o of outcomes) {
      if (o.error) {
        // 出错槽位写入错误结果，表格可显示「异常」而非空白
        taskStore.validationResults[o.index] = {
          serTaskId: '',
          serValid: false,
          rawProjectName: '',
          rawTitle: '',
          serChecks: [],
          serError: o.error.message,
        }
        logStore.addLog('error', `[${o.index + 1}] 校验异常: ${o.error.message}`)
        continue
      }
      taskStore.validationResults[o.index] = o.result
      if (o.result?.serValid) validCount++
      logStore.addLog(
        o.result?.serValid ? 'success' : 'warning',
        `[${o.index + 1}] ${o.result?.serValid ? '通过' : '失败'}: ${ttv[o.index].rawProjectName}`,
      )
      if (o.commentMatches) {
        commentCheckResults.value[o.index] = o.commentMatches
        if (!isRulesPassed(o.commentMatches, commentMatchMode || 'all')) {
          logStore.addLog('warning', `[${o.index + 1}] 评论区未通过: ${failedRuleLabels(o.commentMatches)}`)
        }
      }
    }
    logStore.addLog('success', `校验完成: ${validCount}/${ttv.length} 通过`)
  } finally {
    // 无论成功、中止还是异常，都必须恢复按钮状态避免永久 loading
    isValidating.value = false
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
  } catch (e: any) {
    logStore.addLog('error', `导出异常: ${e.message}`)
  } finally {
    isExporting.value = false
  }
}

/**
 * 编辑单条任务后重新校验，保证校验状态与编辑后的内容一致
 * @param {number} index 任务索引
 */
async function revalidateTask(index: number) {
  const task = tasks.value[index]
  if (!task || !task.rawUrl) return
  const { cookie, handlerName, checkRules, boundaryRules, boundaryMatchMode, commentRules, commentMatchMode } =
    store.config
  if (!cookie) return

  const outcomes = await validateBatch(
    [
      {
        rawSeq: task.rawSeq,
        rawProjectName: task.rawProjectName,
        rawTitle: task.rawTitle,
        rawScore: task.rawScore,
        rawEstimatedHours: task.rawEstimatedHours,
        rawRemark: task.rawRemark,
        rawUrl: task.rawUrl,
      },
    ],
    {
      cookie,
      handlerName,
      checkRules: checkRules || [],
      boundaryRules,
      boundaryMatchMode,
      commentRules: commentRules || [],
      commentMatchMode: commentMatchMode || 'all',
    },
  )
  const o = outcomes[0]
  if (!o) return
  if (o.error) {
    taskStore.validationResults[index] = {
      serTaskId: '',
      serValid: false,
      rawProjectName: '',
      rawTitle: '',
      serChecks: [],
      serError: o.error.message,
    }
    return
  }
  taskStore.validationResults[index] = o.result
  if (o.commentMatches) {
    taskStore.commentCheckResults[index] = o.commentMatches
  }
}

function handleUpdateTask(index: number, data: Partial<TaskItem>) {
  taskStore.updateTask(index, data)
  logStore.addLog('info', `更新任务 #${index + 1}`)
  // 编辑后重新校验该条任务，避免校验标签与内容脱节
  revalidateTask(index)
}

function handleRemoveTask(index: number) {
  // 删除任务时同步移除其校验与评论检查结果，保持索引对齐
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
