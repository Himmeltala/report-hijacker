<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14 01:23:22
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04 12:14:04
 * @FilePath: \src\views\TaskExtract\index.vue
 * @Description: 描述
-->

<template>
  <div class="page-extract-task">
    <div class="page-toolbar">
      <div class="toolbar-actions">
        <el-button type="primary" @click="handleParse" :disabled="!rawText.trim()">
          <el-icon><Document /></el-icon>解析
        </el-button>
        <el-button @click="handleSync" :disabled="!extractedTasks.length" :loading="syncing">
          <el-icon><Connection /></el-icon>同步
        </el-button>
        <el-divider direction="vertical" />
        <el-button @click="handleCopy" :disabled="!extractedTasks.length">
          <el-icon><CopyDocument /></el-icon>复制文本
        </el-button>
        <el-button @click="handleSaveToHistory" :disabled="!extractedTasks.length">
          <el-icon><Collection /></el-icon>保存历史
        </el-button>
        <el-divider direction="vertical" />
        <el-button @click="handleClear">
          <el-icon><Delete /></el-icon>清空
        </el-button>
      </div>
      <div class="toolbar-right" v-if="allTasks.length">
        <span class="stats-text">
          当前处理人: <strong>{{ currentHandler || '(未设置)' }}</strong> &nbsp;|&nbsp; 提取
          <strong>{{ extractedTasks.length }}</strong> / {{ allTasks.length }} 条 &nbsp;|&nbsp; 总工时
          <strong>{{ totalHours }}</strong> h
        </span>
      </div>
    </div>

    <ParseInput v-model:text="rawText" :unrecognized-lines="unrecognizedLines" />

    <div class="result-wrapper">
      <el-scrollbar>
        <el-table border :data="extractedTasks" stripe style="width: 100%">
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
          <el-table-column
            align="center"
            fixed="left"
            label="文本项目"
            min-width="150"
            prop="rawProjectName"
            show-overflow-tooltip
          />
          <el-table-column
            align="center"
            fixed="left"
            label="文本标题"
            min-width="220"
            prop="rawTitle"
            show-overflow-tooltip
          />
          <el-table-column label="平台状态" align="center" min-width="100">
            <template #default="{ $index }">
              <el-tag
                v-if="syncResults[$index]?.remote?._embedded?.status?.name"
                :type="statusTagType(syncResults[$index].remote?._embedded?.status?.name)"
              >
                {{ syncResults[$index].remote?._embedded?.status?.name }}
              </el-tag>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="平台类型" align="center" min-width="100">
            <template #default="{ $index }">
              <el-tag
                v-if="syncResults[$index]?.remote?._embedded?.type?.name"
                :type="taskTypeTagType(syncResults[$index].remote?._embedded?.type?.name)"
              >
                {{ syncResults[$index].remote?._embedded?.type?.name }}
              </el-tag>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="校验" align="center" min-width="100">
            <template #default="{ $index }">
              <el-tag v-if="syncResults[$index]" :type="syncResults[$index].serValid ? 'success' : 'danger'">
                {{ syncResults[$index].serValid ? '通过' : '异常' }}
              </el-tag>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="平台评价" align="center" min-width="100">
            <template #default="{ $index }">
              <el-tag
                v-if="syncResults[$index]?.remote?._links?.customField62?.title"
                :type="evalTagType(syncResults[$index].remote?._links?.customField62?.title)"
              >
                {{ syncResults[$index].remote?._links?.customField62?.title }}
              </el-tag>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="文本预估时长" align="center" prop="rawScore" min-width="130" />
          <el-table-column label="平台自评时长" align="center" min-width="130">
            <template #default="{ $index }">
              <span v-if="syncResults[$index]">{{
                convertIso8601ToHours(syncResults[$index].remote?.estimatedTime)
              }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="平台预估时长" align="center" min-width="130">
            <template #default="{ $index }">
              <span v-if="syncResults[$index]">{{ syncResults[$index].remote?.customField105 || '-' }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="平台开始日期" align="center" min-width="120">
            <template #default="{ $index }">
              <span v-if="syncResults[$index]">{{ syncResults[$index].remote?.startDate || '-' }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="平台截止日期" align="center" min-width="120">
            <template #default="{ $index }">
              <span v-if="syncResults[$index]">{{ syncResults[$index].remote?.dueDate || '-' }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="平台工期" align="center" min-width="100">
            <template #default="{ $index }">
              <span v-if="syncResults[$index]?.remote?.duration">{{
                formatIso8601Duration(syncResults[$index].remote?.duration)
              }}</span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" align="center" fixed="right" min-width="240">
            <template #default="{ $index }">
              <el-button v-if="syncResults[$index]" type="primary" text @click="showDetail($index)"> 详情 </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-scrollbar>
    </div>

    <StatusBar
      v-if="allTasks.length"
      :taskCount="extractedTasks.length"
      :validCount="syncValidCount"
      :invalidCount="syncInvalidCount"
    />
  </div>
</template>

<script setup lang="ts">
// #region 引入
import { ref, computed, watch } from 'vue'
import { debounce } from 'lodash-es'
import { Document, CopyDocument, Delete, Collection, Connection } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useLogStore } from '@/stores/log.store'
import { useModal } from '@/composables/useModal'
import { validateBatch, type TaskToValidate } from '@/services/taskValidation'
import { isRulesPassed, failedRuleLabels } from '@/services/validationRules'
import { mergeTasksIntoHistory } from '@/services/historyPersistence'
import { convertIso8601ToHours, formatIso8601Duration } from '@/utils/parser'
import type { ValidationResult, CommentRuleMatch } from '@/types/task'
import type { HistoryTaskItem } from '@/types/ipc'
import { statusTagType, evalTagType, taskTypeTagType } from '@/utils/tag'
import ParseInput from '@/components/ParseInput.vue'
import StatusBar from '@/views/TaskExtract/components/StatusBar.vue'
// #endregion

// #region 类型定义
interface ExtractTaskItem {
  rawSeq: string
  rawProjectName: string
  rawTitle: string
  rawHandler: string
  rawUrl: string
  rawScore: string
  rawEstimatedHours: string
  rawRemark: string
  rawText: string
}
// #endregion

// #region Stores
const store = useSettingsStore()
const logStore = useLogStore()
// #endregion

// #region 响应式状态
const rawText = ref('')
const unrecognizedLines = ref<string[]>([])
const allTasks = ref<ExtractTaskItem[]>([])
const extractedTasks = ref<ExtractTaskItem[]>([])
const syncing = ref(false)
const syncResults = ref<(ValidationResult | null)[]>([])
const commentCheckResults = ref<(CommentRuleMatch[] | null)[]>([])
// 任务集合代际计数，解析或清空时递增，用于丢弃在途同步的过期结果
let parseEpoch = 0
// #endregion

// #region 计算属性
const currentHandler = computed(() => store.config.handlerName)
const totalHours = computed(() => {
  let sum = 0
  for (const t of extractedTasks.value) sum += parseFloat(t.rawScore) || 0
  return Math.round(sum * 100) / 100
})

// 按同步结果统计实际通过数与失败数，未同步时均为 0
const syncValidCount = computed(() => syncResults.value.filter((r) => r?.serValid).length)
const syncInvalidCount = computed(() => syncResults.value.filter((r) => r && !r.serValid).length)
// #endregion

// #region 解析
function getTaskRegex(): RegExp | null {
  const source = store.config.groupRegex
  if (!source) return null
  try {
    return new RegExp(source)
  } catch {
    return null
  }
}

function extractHandler(remark: string): string {
  const idx = remark.lastIndexOf('-')
  return idx >= 0 ? remark.slice(idx + 1).trim() : ''
}

function doParse() {
  const text = rawText.value.trim()
  if (!text) {
    allTasks.value = []
    unrecognizedLines.value = []
    extractedTasks.value = []
    syncResults.value = []
    commentCheckResults.value = []
    return
  }

  const re = getTaskRegex()
  if (!re) {
    allTasks.value = []
    unrecognizedLines.value = []
    extractedTasks.value = []
    syncResults.value = []
    commentCheckResults.value = []
    return
  }

  const lines = text.split('\n')
  const parsed: ExtractTaskItem[] = []
  const unrec: string[] = []

  const requiredGroups = new Set(['seq', 'projectName', 'remark', 'url', 'score', 'estimatedHours'])

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const match = trimmed.match(re)
    if (match?.groups) {
      const missing: string[] = []
      for (const g of requiredGroups) {
        // 具名组必须在正则中定义，值允许为空（如可选的自评工时前缀）
        if (!(g in match.groups)) missing.push(g)
      }
      if (missing.length) {
        unrec.push(trimmed)
        continue
      }

      const g = match.groups
      const remark = g.remark?.trim() || ''
      const handler = extractHandler(remark)
      const title = handler ? remark.slice(0, -(handler.length + 1)).trim() : remark

      parsed.push({
        rawSeq: g.seq || '',
        rawProjectName: g.projectName?.replace(/-$/, '').trim() || '',
        rawTitle: title,
        rawHandler: handler,
        rawUrl: g.url?.trim() || '',
        rawScore: g.score || '',
        rawEstimatedHours: g.estimatedHours || '',
        rawRemark: remark,
        rawText: trimmed,
      })
    } else {
      unrec.push(trimmed)
    }
  }

  allTasks.value = parsed
  // 任务集合变化后旧的同步结果按索引已错位，必须清空
  syncResults.value = []
  commentCheckResults.value = []
  // 任务集合代际递增，使在途同步识别到表格已变更并放弃过期结果
  parseEpoch++

  const selfName = currentHandler.value
  if (selfName) {
    extractedTasks.value = parsed.filter((t) => t.rawHandler === selfName)
    // 正则匹配成功但不属于当前处理人的行，纳入未识别区域显示
    const otherHandlerTasks = parsed.filter((t) => t.rawHandler !== selfName)
    for (const t of otherHandlerTasks) {
      unrec.push(t.rawText)
    }
  } else {
    extractedTasks.value = []
  }

  unrecognizedLines.value = unrec
  logStore.addLog('info', `解析完成: ${parsed.length} 条任务, 提取 ${extractedTasks.value.length} 条`)
}

function handleParse() {
  if (!rawText.value.trim()) return

  const re = getTaskRegex()
  if (!re) {
    logStore.addLog('warning', '请先在设置中填写提取解析正则')
    return
  }

  // 取消排队的自动解析，避免手动解析后重复执行产生重复日志
  autoParse.cancel()
  doParse()

  if (unrecognizedLines.value.length > 0) {
    logStore.addLog('warning', `${unrecognizedLines.value.length} 行格式无法识别`)
  }

  const selfName = currentHandler.value
  if (selfName) {
    if (extractedTasks.value.length > 0) {
      logStore.addLog('success', `提取 ${selfName} 的任务 ${extractedTasks.value.length} 条`)
    } else {
      logStore.addLog('info', `未找到 ${selfName} 的任务`)
    }
  } else {
    logStore.addLog('info', '未设置处理人，请在设置中填写')
  }
}
// #endregion

// #region 同步（获取远程字段）

function showDetail(index: number) {
  const result = syncResults.value[index]
  if (result) {
    detailModal.open({
      result,
      commentResult: commentCheckResults.value[index] ?? null,
      commentMatchMode: store.config.commentMatchMode || 'all',
    })
  }
}

async function handleSync() {
  const tasks = extractedTasks.value
  if (!tasks.length) return

  const { cookie, handlerName, checkRules, boundaryRules, boundaryMatchMode, commentRules, commentMatchMode } =
    store.config
  if (!cookie) {
    logStore.addLog('warning', '请先在设置中填写 Cookie')
    return
  }

  syncing.value = true
  syncResults.value = []
  commentCheckResults.value = []
  const epoch = parseEpoch

  try {
    const ttv: TaskToValidate[] = tasks.map((t) => ({
      rawSeq: t.rawSeq,
      rawProjectName: t.rawProjectName,
      rawTitle: t.rawTitle,
      rawScore: t.rawScore,
      rawEstimatedHours: t.rawEstimatedHours,
      rawRemark: t.rawRemark,
      rawUrl: t.rawUrl,
    }))

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
          logStore.addLog('info', `[${i + 1}/${total}] 同步: ${task.rawProjectName} - ${task.rawTitle}`)
        },
      },
    )

    // 同步期间表格被重新解析或清空时放弃过期结果，避免旧结果按旧索引写回新表格
    if (epoch !== parseEpoch) {
      logStore.addLog('warning', '任务列表已变更，已放弃本次同步结果')
      return
    }

    // 按原索引写入结果与日志
    let validCount = 0
    for (const o of outcomes) {
      if (o.error) {
        logStore.addLog('error', `[${o.index + 1}] 同步异常: ${o.error.message}`)
        continue
      }
      syncResults.value[o.index] = o.result
      if (o.result?.serValid) validCount++
      logStore.addLog(
        o.result?.serValid ? 'success' : 'warning',
        `[${o.index + 1}] ${o.result?.serValid ? '通过' : '异常'}`,
      )
      if (o.commentMatches) {
        commentCheckResults.value[o.index] = o.commentMatches
        if (!isRulesPassed(o.commentMatches, commentMatchMode || 'all')) {
          logStore.addLog('warning', `[${o.index + 1}] 评论区未通过: ${failedRuleLabels(o.commentMatches)}`)
        }
      }
    }
    logStore.addLog('success', `同步完成: ${validCount}/${ttv.length} 条`)
  } finally {
    // 无论成功、中止还是异常，都必须恢复按钮状态避免永久 loading
    syncing.value = false
  }
}
// #endregion

// #region 自动解析（防抖）
const autoParse = debounce(doParse, 500)

watch(rawText, () => {
  autoParse()
})
// #endregion

// #region 复制
function handleCopy() {
  if (!extractedTasks.value.length) return

  const lines = extractedTasks.value.map((t, i) => {
    return t.rawText.replace(/^\d+/, String(i + 1))
  })

  const text = lines.join('\n')
  navigator.clipboard.writeText(text).then(
    () => logStore.addLog('success', '已复制提取文本'),
    () => logStore.addLog('error', '复制失败'),
  )
  logStore.addLog('info', `已复制提取文本 (${extractedTasks.value.length} 条)`)
}
// #endregion

// #region 函数式弹窗与保存历史
const saveModal = useModal({
  component: () => import('@/views/TaskExtract/modals/SaveHistoryModal.vue'),
  autoCloseEvents: ['close', 'cancel', 'confirm'],
})

const detailModal = useModal({
  component: () => import('@/modals/TaskDetailModal.vue'),
  autoCloseEvents: ['close'],
})

async function handleSaveToHistory() {
  if (!extractedTasks.value.length) return

  const today = new Date().toISOString().slice(0, 10)
  let defaultDate = today
  try {
    const last = await window.electron.storeGet('lastSaveHistoryDate')
    if (last) defaultDate = last
  } catch {
    //
  }

  saveModal.open(
    { taskCount: extractedTasks.value.length, defaultDate },
    {
      confirm: async (date: string) => {
        await doSaveHistory(date)
        await window.electron.storeSet('lastSaveHistoryDate', date)
      },
    },
  )
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

async function doSaveHistory(dateStr: string) {
  const now = new Date().toISOString()

  const tasks: HistoryTaskItem[] = extractedTasks.value.map((t, i) => {
    // 同步过的任务保留远程数据与校验结果，避免保存历史后回到未同步状态
    const syncResult = syncResults.value[i] ?? null
    const remote = syncResult?.remote ?? null
    const synced = !!remote
    return {
      serId: genId(),
      rawSeq: i + 1,
      serDate: dateStr,
      rawProjectName: t.rawProjectName,
      rawTitle: t.rawTitle,
      rawHandler: t.rawHandler,
      rawUrl: t.rawUrl,
      rawScore: t.rawScore,
      rawRemark: t.rawRemark,
      rawEstimatedHours: t.rawEstimatedHours || t.rawScore,
      rawText: t.rawText,
      // 远程数据与本地不一致时以平台数据为准覆盖本地
      serSyncStatus: synced ? ('synced' as const) : ('none' as const),
      serWorkPackageId: syncResult?.serTaskId || null,
      remote: remote,
      serSyncedAt: synced ? now : null,
      serCheckResult: synced ? syncResult : null,
      serCommentCheckResult: synced ? (commentCheckResults.value[i] ?? null) : null,
      serPriority: null,
      serTimeLimit: null,
      serPostponed: false,
      serPostponedReason: '',
      serCreatedAt: now,
      serUpdatedAt: now,
    }
  })

  try {
    const added = await mergeTasksIntoHistory(dateStr, tasks)
    logStore.addLog('success', `已保存到历史: 新增 ${added} 条`)
    logStore.addLog('info', `保存历史任务: ${dateStr} (${tasks.length} 条)`)
  } catch (e: any) {
    logStore.addLog('error', '保存失败: ' + (e.message || ''))
    logStore.addLog('error', '保存历史任务失败')
  }
}
// #endregion

// #region 清空
function handleClear() {
  // 取消排队的自动解析，避免清空后 500 毫秒再触发一次空解析
  autoParse.cancel()
  rawText.value = ''
  unrecognizedLines.value = []
  allTasks.value = []
  extractedTasks.value = []
  syncResults.value = []
  commentCheckResults.value = []
  // 任务集合代际递增，使在途同步识别到表格已清空并放弃过期结果
  parseEpoch++
  // 仅清本页数据，日志面板为全局共享，不清空其他页面的操作记录
  logStore.addLog('info', '已清空')
}
// #endregion
</script>

<style scoped>
.page-extract-task {
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
.result-wrapper {
  flex: 1;
  overflow: hidden;
  padding: var(--app-space-2);
}
</style>
