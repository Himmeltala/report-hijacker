<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14 01:23:43
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 16:30:00
 * @FilePath: \src\views\CheckTask\index.vue
 * @Description: 检查任务页面 - 输入文本解析后执行 AI 审查，展示结论
-->

<template>
  <div class="page-check-task">
    <div class="page-toolbar">
      <div class="toolbar-actions">
        <el-button type="primary" @click="handleParse" :disabled="!rawText.trim()">
          <el-icon><Document /></el-icon>解析
        </el-button>
        <el-button @click="handleValidate" :disabled="parsedTasks.length === 0" :loading="isValidating">
          <el-icon><Select /></el-icon>AI 审查
        </el-button>
        <el-divider direction="vertical" />
        <el-button @click="handleClear">
          <el-icon><Delete /></el-icon>清空
        </el-button>
      </div>
    </div>

    <ParseInput v-model:text="rawText" :unrecognized-lines="unrecognizedLines" />

    <div v-if="stats.totalTasks" class="stats-bar">
      <span class="stat-item"
        >任务数 <strong>{{ stats.totalTasks }}</strong></span
      >
      <el-divider direction="vertical" />
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

    <div class="table-area">
      <el-scrollbar>
        <el-table border :data="parsedTasks" stripe style="width: 100%">
          <template #empty>
            <el-empty description="暂无数据" />
          </template>
          <el-table-column align="center" fixed="left" label="链接" min-width="250">
            <template #default="{ row }">
              <el-link v-if="row.rawUrl" :href="row.rawUrl" target="_blank" type="primary" underline="never">
                {{ row.rawUrl }}
              </el-link>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column align="center" fixed="left" label="文本项目" min-width="150" prop="rawProjectName" />
          <el-table-column align="center" fixed="left" label="文本标题" min-width="220" prop="rawTitle" />
          <el-table-column label="平台状态" align="center" min-width="100">
            <template #default="{ $index }">
              <el-tag
                v-if="detailResults[$index]?.remote?._embedded?.status?.name"
                :type="statusTagType(detailResults[$index].remote?._embedded?.status?.name)"
              >
                {{ detailResults[$index].remote?._embedded?.status?.name }}
              </el-tag>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="平台类型" align="center" min-width="100">
            <template #default="{ $index }">
              <el-tag
                v-if="detailResults[$index]?.remote?._embedded?.type?.name"
                :type="taskTypeTagType(detailResults[$index].remote?._embedded?.type?.name)"
              >
                {{ detailResults[$index].remote?._embedded?.type?.name }}
              </el-tag>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="AI 审查" align="center" min-width="320">
            <template #default="{ $index }">
              <MarkdownText v-if="aiConclusions[$index]" :text="aiConclusions[$index]" class="ai-conclusion" />
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="平台评价" align="center" min-width="100">
            <template #default="{ $index }">
              <el-tag
                v-if="detailResults[$index]?.remote?._links?.customField62?.title"
                :type="evaluationTagType(detailResults[$index].remote?._links?.customField62?.title)"
              >
                {{ detailResults[$index].remote?._links?.customField62?.title }}
              </el-tag>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="文本预估时长" align="center" prop="rawScore" min-width="130" />
          <el-table-column label="平台自评时长" align="center" min-width="130">
            <template #default="{ $index }">
              <span v-if="detailResults[$index]">{{
                convertIso8601ToHours(detailResults[$index].remote?.estimatedTime)
              }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="平台预估时长" align="center" min-width="130">
            <template #default="{ $index }">
              <span v-if="detailResults[$index]">{{ detailResults[$index].remote?.customField105 || '-' }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="平台开始日期" align="center" min-width="120">
            <template #default="{ $index }">
              <span v-if="detailResults[$index]">{{ detailResults[$index].remote?.startDate || '-' }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="平台截止日期" align="center" min-width="120">
            <template #default="{ $index }">
              <span v-if="detailResults[$index]">{{ detailResults[$index].remote?.dueDate || '-' }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="平台工期" align="center" min-width="100">
            <template #default="{ $index }">
              <span v-if="detailResults[$index]?.remote?.duration">{{
                formatIso8601Duration(detailResults[$index].remote?.duration)
              }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" align="center" fixed="right" min-width="240">
            <template #default="{ $index }">
              <el-button v-if="detailResults[$index]" type="primary" text @click="showDetail($index)">详情</el-button>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
        </el-table>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Document, Select, Delete } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useLogStore } from '@/stores/log.store'
import { useModal } from '@/composables/useModal'
import { parseTaskText, convertIso8601ToHours, formatIso8601Duration } from '@/utils/parser'
import { reviewBatch, isAiReviewPassed, toTaskToValidate, type TaskToValidate } from '@/services/taskValidation'
import { computeTaskStats } from '@/services/taskStats'
import type { TaskItem, TaskDetailResult } from '@/types/task'
import { statusTagType, evaluationTagType, taskTypeTagType } from '@/utils/tag'
import ParseInput from '@/components/ParseInput.vue'
import MarkdownText from '@/components/MarkdownText.vue'

const store = useSettingsStore()
const logStore = useLogStore()

const detailModal = useModal<{ result: TaskDetailResult | null; aiConclusion?: string | null }>({
  component: () => import('@/modals/TaskDetailModal.vue'),
  autoCloseEvents: ['close'],
})

const isValidating = ref(false)
const rawText = ref('')
const unrecognizedLines = ref<string[]>([])
const parsedTasks = ref<TaskItem[]>([])
const detailResults = ref<(TaskDetailResult | null)[]>([])
const aiConclusions = ref<(string | null)[]>([])

const stats = computed(() =>
  computeTaskStats(
    parsedTasks.value,
    detailResults.value.map((r) => r?.remote),
  ),
)

function handleParse() {
  if (!rawText.value.trim()) return
  const regexStr = store.config.taskRegex
  if (!regexStr) {
    logStore.addLog('warning', '请先在设置中填写导出解析正则')
    return
  }
  const { tasks, unrecognized } = parseTaskText(rawText.value, regexStr)
  parsedTasks.value = tasks
  unrecognizedLines.value = unrecognized
  detailResults.value = []
  aiConclusions.value = []

  logStore.addLog('info', `解析完成: ${tasks.length} 条任务, ${unrecognized.length} 行未识别`)
  if (unrecognized.length > 0) {
    logStore.addLog('warning', `${unrecognized.length} 行格式无法识别`)
  } else if (tasks.length > 0) {
    logStore.addLog('success', `成功解析 ${tasks.length} 条任务`)
  } else {
    logStore.addLog('info', '未解析到任何任务')
  }
}

async function handleValidate() {
  if (parsedTasks.value.length === 0) return
  const { cookie, handlerName, departmentName, aiEnabled } = store.config
  if (!cookie) {
    logStore.addLog('warning', '请先在设置中填写 Cookie')
    return
  }
  if (!aiEnabled) {
    logStore.addLog('warning', '请先在设置中启用 AI 审查')
    return
  }

  isValidating.value = true
  detailResults.value = []
  aiConclusions.value = []

  const ttv: TaskToValidate[] = parsedTasks.value.map(toTaskToValidate)

  try {
    const outcomes = await reviewBatch(
      ttv,
      { cookie, handlerName, departmentName, aiEnabled },
      {
        onTaskStart: (i, total, task) => {
          logStore.addLog('info', `[${i + 1}/${total}] ${task.rawProjectName} - ${task.rawTitle}`)
        },
      },
    )

    // 按原索引写入结果与日志
    for (const o of outcomes) {
      if (o.error) {
        logStore.addLog('error', `[${o.index + 1}] 处理异常: ${o.error.message}`)
        continue
      }
      detailResults.value[o.index] = o.result
      if (o.result?.serError) {
        logStore.addLog('error', `[${o.index + 1}] 平台数据获取失败: ${o.result.serError}`)
      }
      aiConclusions.value[o.index] = o.aiConclusion ?? null
      if (o.aiConclusion) {
        if (o.aiPrompt) logStore.addLog('info', `[${o.index + 1}] AI 输入: ${o.aiPrompt}`)
        if (o.aiReasoning) logStore.addLog('info', `[${o.index + 1}] AI 思考: ${o.aiReasoning}`)
        logStore.addLog(
          isAiReviewPassed(o.aiConclusion) ? 'success' : 'warning',
          `[${o.index + 1}] AI 审查: ${o.aiConclusion}`,
        )
      } else if (o.aiError) {
        logStore.addLog('warning', `[${o.index + 1}] AI 审查失败: ${o.aiError}`)
      }
    }
    const passed = outcomes.filter((o) => isAiReviewPassed(o.aiConclusion)).length
    logStore.addLog('success', `AI 审查完成: ${passed}/${ttv.length} 通过`)
  } finally {
    // 无论成功、中止还是异常，都必须恢复按钮状态避免永久 loading
    isValidating.value = false
  }
}

function showDetail(index: number) {
  const result = detailResults.value[index]
  if (result) {
    detailModal.open({
      result,
      aiConclusion: aiConclusions.value[index] ?? null,
    })
  }
}

function handleClear() {
  rawText.value = ''
  unrecognizedLines.value = []
  parsedTasks.value = []
  detailResults.value = []
  aiConclusions.value = []
  // 仅清本页数据，日志面板为全局共享，不清空其他页面的操作记录
  logStore.addLog('info', '已清空')
}
</script>

<style scoped>
.page-check-task {
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
}
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: var(--app-gap-toolbar);
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
.table-area {
  flex: 1;
  overflow: hidden;
  padding: var(--app-space-2) var(--app-space-2) 0;
  display: flex;
  flex-direction: column;
}
.table-area .el-scrollbar {
  flex: 1;
}
.ai-conclusion {
  max-height: 280px;
  overflow: auto;
  text-align: left;
  padding: 2px 4px;
}
</style>
