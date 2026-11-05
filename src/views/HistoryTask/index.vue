<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14 08:54:08
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-05 10:45:00
 * @FilePath: \src\views\HistoryTask\index.vue
 * @Description: 历史任务页面
-->
<template>
  <div class="page-history">
    <ToolBar
      :state="toolbarState"
      @save="handleSaveRange()"
      @delete="handleDeleteCmd"
      @sync-check="handleSyncCheckCmd"
      @copy="handleCopyCmd"
      @export="handleExportCmd"
      @backup="handleBackupCmd"
      @abort-sync="handleAbortSync"
      @abort-check="handleAbortCheck"
    />

    <FilterBar
      v-model="filters"
      :tasks="allDisplayTasks"
      :searching="searching"
      @search="onSearch"
      @restored="onFilterRestored"
    />

    <div v-if="stats.totalTasks" class="stats-bar">
      <span class="stat-item"
        >任务数 <strong>{{ stats.totalTasks }}</strong></span
      >
      <el-divider direction="vertical" />
      <span class="stat-item"
        >平台自评时长 <strong>{{ stats.totalSelfHours }}</strong
        >h</span
      >
      <span class="stat-item"
        >平台预估时长 <strong>{{ stats.totalEstHours }}</strong
        >h</span
      >
      <span class="stat-item"
        >文本预估时长 <strong>{{ stats.totalScore }}</strong
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
      <el-button text class="stats-detail-btn" @click="showStatsDrawer = true">
        较上期 <el-icon><DArrowRight /></el-icon>
      </el-button>
      <el-button text class="stats-heatmap-btn" @click="showHeatmapDrawer = true">
        <el-icon><TrendCharts /></el-icon>数据统计
      </el-button>
    </div>

    <div class="table-area">
      <el-scrollbar>
        <el-table
          stripe
          border
          :data="pagedTasks"
          style="width: 100%"
          @selection-change="onSelectionChange"
          row-key="serId"
        >
          <template #empty>
            <el-empty description="暂无数据" />
          </template>
          <el-table-column align="center" fixed="left" type="selection" min-width="48" />
          <el-table-column align="center" fixed="left" label="链接" min-width="250">
            <template #default="{ row }">
              <el-link v-if="row.rawUrl" :href="row.rawUrl" target="_blank" type="primary" underline="never">
                {{ row.rawUrl }}
              </el-link>
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
          <el-table-column label="添加日期" prop="serDate" align="center" min-width="120" />
          <el-table-column label="执行优先级" align="center" min-width="100">
            <template #default="{ row }">
              <el-tag
                v-if="row.serPriority"
                :type="priorityTagType(row.serPriority)"
                effect="dark"
                style="cursor: pointer"
                @click="openPriorityDialog(row)"
              >
                {{ priorityLabel(row.serPriority) }}
              </el-tag>
              <span v-else class="text-muted" style="cursor: pointer" @click="openPriorityDialog(row)">-</span>
            </template>
          </el-table-column>
          <el-table-column label="执行延期" align="center" min-width="120">
            <template #default="{ row }">
              <el-tag
                v-if="row.serPostponed"
                type="danger"
                effect="dark"
                style="cursor: pointer"
                @click="openPostponeDialog(row)"
              >
                延期
              </el-tag>
              <span v-else class="text-muted" style="cursor: pointer" @click="openPostponeDialog(row)">-</span>
            </template>
          </el-table-column>
          <el-table-column label="同步状态" align="center" min-width="100">
            <template #default="{ row }">
              <el-tag v-if="row.serSyncStatus === 'synced'" type="success">已同步</el-tag>
              <el-tag v-else type="info">未同步</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="平台状态" align="center" min-width="100">
            <template #default="{ row }">
              <el-tag
                v-if="row.remote?._embedded?.status?.name"
                :type="statusTagType(row.remote._embedded.status.name)"
              >
                {{ row.remote._embedded.status.name }}
              </el-tag>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="平台类型" align="center" min-width="100">
            <template #default="{ row }">
              <el-tag
                v-if="row.remote?._embedded?.type?.name"
                :type="row.remote._embedded.type.name === '任务' ? 'primary' : 'warning'"
              >
                {{ row.remote._embedded.type.name }}
              </el-tag>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="AI 审查" align="center" min-width="120">
            <template #default="{ row }">
              <el-tag
                v-if="row.serAiConclusion"
                :type="isAiReviewPassed(row.serAiConclusion) ? 'success' : 'danger'"
                style="cursor: pointer"
                @click="showDetail(row)"
              >
                {{ isAiReviewPassed(row.serAiConclusion) ? '通过' : '未通过' }}
              </el-tag>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="限时任务" align="center" min-width="100">
            <template #default="{ row }">
              <el-tag
                v-if="row.serTimeLimit"
                :type="timeLimitTagType(row.serTimeLimit)"
                effect="dark"
                style="cursor: pointer"
                @click="openTimeLimitDialog(row)"
              >
                {{ timeLimitLabel(row.serTimeLimit) }}
              </el-tag>
              <span v-else class="text-muted" style="cursor: pointer" @click="openTimeLimitDialog(row)">-</span>
            </template>
          </el-table-column>
          <el-table-column label="平台评价" align="center" min-width="100">
            <template #default="{ row }">
              <el-tag
                v-if="row.remote?._links?.customField62?.title"
                :type="evaluationTagType(row.remote._links.customField62.title)"
              >
                {{ row.remote._links.customField62.title }}
              </el-tag>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="文本预估时长" align="center" prop="rawScore" min-width="130" />
          <el-table-column label="平台自评时长" align="center" min-width="130">
            <template #default="{ row }">
              <span>{{ row.remote?.estimatedTime ? convertIso8601ToHours(row.remote.estimatedTime) : '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="平台预估时长" align="center" min-width="130">
            <template #default="{ row }">
              <span>{{ row.remote?.customField105 || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="平台开始日期" align="center" min-width="120">
            <template #default="{ row }">
              <span>{{ row.remote?.startDate || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="平台截止日期" align="center" min-width="120">
            <template #default="{ row }">
              <span>{{ row.remote?.dueDate || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="平台工期" align="center" min-width="100">
            <template #default="{ row }">
              <span>{{ row.remote?.duration ? formatIso8601Duration(row.remote.duration) : '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" align="center" min-width="310">
            <template #default="{ row }">
              <el-button type="primary" text @click="showDetail(row)">详情</el-button>
              <el-button type="primary" text @click="openEditDialog(row)">编辑任务</el-button>
              <el-popconfirm title="确认删除该任务?" @confirm="removeTask(row)">
                <template #reference>
                  <el-button type="danger" text>删除任务</el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </el-scrollbar>
      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="displayTasks.length"
          layout="total, sizes, prev, pager, next"
          :page-sizes="pageSizeList"
          background
        />
      </div>
    </div>

    <el-drawer v-model="showStatsDrawer" size="480px" direction="rtl">
      <template #header>
        <span>统计详情</span>
        <span class="drawer-subtitle" v-if="prevRangeLabel">上期: {{ prevRangeLabel }}</span>
      </template>
      <div class="drawer-resize-handle" ref="statsResizeHandle" @mousedown="statsResizeMousedown"></div>
      <CompareWithLastDrawer v-if="showStatsDrawer" :chart-data="chartData" :detail-rows="detailRows" />
    </el-drawer>

    <el-drawer v-model="showHeatmapDrawer" size="640px" direction="rtl">
      <template #header>
        <span>数据统计</span>
      </template>
      <div class="drawer-resize-handle" ref="heatmapResizeHandle" @mousedown="heatmapResizeMousedown"></div>
      <StatsOverviewDrawer v-if="showHeatmapDrawer" />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
// #region 引入
import { ref, shallowRef, computed, onMounted, onBeforeUnmount, reactive, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { DArrowRight, TrendCharts } from '@element-plus/icons-vue'
import { useDrawerResize } from '@/composables/useDrawerResize'
import { useSettingsStore } from '@/stores/settings.store'
import { useLogStore } from '@/stores/log.store'
import { useModal } from '@/composables/useModal'
import { reviewBatch, isAiReviewPassed, type TaskToValidate } from '@/services/taskValidation'
import { computeTaskStats } from '@/services/taskStats'
import { flushHistoryChanges } from '@/services/historyPersistence'
import { compareTaskOrder, type TaskOrderFields } from '@/services/taskOrder'
import { taskMatchesKeyword } from '@/services/taskSearch'
import { convertIso8601ToHours, formatIso8601Duration } from '@/utils/parser'
import { maybeShowSysNotification } from '@/utils/sysNotification'
import { ipc } from '@/utils/ipc'
import { createAutoSyncSchedule } from '@schedules/renderer/autoSyncSchedule'
import CompareWithLastDrawer from '@/views/HistoryTask/components/CompareWithLastDrawer.vue'
import StatsOverviewDrawer from '@/views/HistoryTask/components/StatsOverviewDrawer.vue'
import FilterBar, { createDefaultFilterState, type FilterState } from '@/views/HistoryTask/components/FilterBar.vue'
import ToolBar, { type ToolbarState } from '@/views/HistoryTask/components/ToolBar.vue'
import type { HistoryDay, HistoryTaskItem } from '@/types/ipc'
import {
  statusTagType,
  evaluationTagType,
  priorityTagType,
  priorityLabel,
  timeLimitTagType,
  timeLimitLabel,
  PAGE_SIZE_LIST,
} from '@/utils/tag'
import { addDays, formatYMD } from '@/utils/date'
// #endregion

// #region Stores
const store = useSettingsStore()
const logStore = useLogStore()
// #endregion

// #region 响应式状态
// 筛选栏编辑中的条件，点击搜索后才生效
const filters = reactive<FilterState>(createDefaultFilterState())
// 已生效的筛选条件快照，列表与查询以此为准，条件变更不立即触发搜索
const appliedFilters = reactive<FilterState>(createDefaultFilterState())
const loadedDays = shallowRef<HistoryDay[]>([])
const prevDays = shallowRef<HistoryDay[]>([])
const prevRangeLabel = ref('')
const dirty = ref(false)
const syncing = ref(false)
const searching = ref(false)
const syncingAll = ref(false)
const selection = ref<HistoryTaskItem[]>([])
const showStatsDrawer = ref(false)
const showHeatmapDrawer = ref(false)

// 抽屉拖拽手柄元素引用，用于打开抽屉时恢复上次保存的宽度
const statsResizeHandle = ref<HTMLElement | null>(null)
const heatmapResizeHandle = ref<HTMLElement | null>(null)

// #region 抽屉拖拽调宽，宽度持久化到本地存储
const { handleResizeMousedown: statsResizeMousedown } = useDrawerResize(
  showStatsDrawer,
  { storageKey: 'historyStatsDrawerWidth' },
  statsResizeHandle,
)
const { handleResizeMousedown: heatmapResizeMousedown } = useDrawerResize(
  showHeatmapDrawer,
  { storageKey: 'historyHeatmapDrawerWidth' },
  heatmapResizeHandle,
)
// #endregion
const isExporting = ref(false)
const checking = ref(false)
const checkingAll = ref(false)

const lastSyncTime = ref('')
const backupEnabled = ref(false)
const backingUp = ref(false)
const lastBackupTime = ref('')
const autoSyncRunning = ref(false)
const autoSyncEnabled = ref(false)
// 自动同步设置变更事件的取消订阅函数，页面卸载时移除监听
let unsubscribeAutoSync: (() => void) | null = null
// 自动备份完成事件的取消订阅函数，页面卸载时移除监听
let unsubscribeBackup: (() => void) | null = null
const currentPage = ref(1)
const pageSize = ref(15)
const abortSync = ref(false)
const abortCheck = ref(false)
// #endregion

// #region 函数式弹窗
const editModal = useModal({
  component: () => import('@/views/HistoryTask/modals/EditTaskModal.vue'),
  autoCloseEvents: ['close', 'cancel', 'confirm'],
})

const detailModal = useModal({
  component: () => import('@/modals/TaskDetailModal.vue'),
  autoCloseEvents: ['close'],
})

const postponeModal = useModal({
  component: () => import('@/views/HistoryTask/modals/PostponeModal.vue'),
  autoCloseEvents: ['close', 'cancel', 'confirm'],
})

const priorityModal = useModal({
  component: () => import('@/views/HistoryTask/modals/PriorityModal.vue'),
  autoCloseEvents: ['close', 'cancel', 'confirm'],
})

const timeLimitModal = useModal({
  component: () => import('@/views/HistoryTask/modals/TimeLimitModal.vue'),
  autoCloseEvents: ['close', 'cancel', 'confirm'],
})
// #endregion

// #region 类型定义
interface DisplayTask extends HistoryTaskItem {
  serDate: string
}
// #endregion

// #region 计算属性
const allDisplayTasks = shallowRef<DisplayTask[]>([])

// 重新计算 allDisplayTasks：按平台状态、平台类型排序
function rebuildAllDisplayTasks() {
  const tasks: DisplayTask[] = []
  for (const day of loadedDays.value) {
    for (const t of day.tasks) {
      tasks.push(t as DisplayTask)
    }
  }
  tasks.sort((a, b) => compareTaskOrder(toOrderFields(a), toOrderFields(b)))
  allDisplayTasks.value = tasks
}

/**
 * 取排序字段：状态与类型来自平台数据，日期与序号来自本地记录
 * @param {DisplayTask} t 任务
 * @returns {TaskOrderFields} 排序字段
 */
function toOrderFields(t: DisplayTask): TaskOrderFields {
  return {
    status: t.remote?._embedded?.status?.name,
    type: t.remote?._embedded?.type?.name,
    date: t.serDate,
    seq: t.rawSeq,
  }
}

/**
 * 判断任务是否匹配生效的搜索关键字
 * @param {any} t 任务对象
 * @returns {boolean} 无关键字或匹配时为 true
 */
function matchesKeyword(t: any): boolean {
  return taskMatchesKeyword(t, appliedFilters.keyword)
}

/**
 * 判断任务是否匹配生效的列筛选条件
 * @param {any} t 任务对象
 * @returns {boolean} 全部筛选通过时为 true
 */
function matchesFilters(t: any): boolean {
  // 执行优先级筛选值 "none" 表示未设置
  if (appliedFilters.filterPriority) {
    if (appliedFilters.filterPriority === 'none') {
      if (t.serPriority) return false
    } else {
      if (t.serPriority !== appliedFilters.filterPriority) return false
    }
  }
  if (appliedFilters.filterPostponed) {
    const want = appliedFilters.filterPostponed === 'true'
    if (!!t.serPostponed !== want) return false
  }
  if (appliedFilters.filterSyncStatus && t.serSyncStatus !== appliedFilters.filterSyncStatus) return false
  if (appliedFilters.filterStatus && t.remote?._embedded?.status?.name !== appliedFilters.filterStatus) return false
  if (appliedFilters.filterType && t.remote?._embedded?.type?.name !== appliedFilters.filterType) return false
  if (appliedFilters.filterEval) {
    const title = t.remote?._links?.customField62?.title || ''
    if (appliedFilters.filterEval === '其他') {
      if (title === '好' || title === '合格') return false
    } else {
      if (title !== appliedFilters.filterEval) return false
    }
  }
  // 添加日期：serDate 与选择器值同为 YYYY-MM-DD，可按字典序比较
  const [addedFrom, addedTo] = appliedFilters.filterAddedDate || []
  if (addedFrom && addedTo && (t.serDate < addedFrom || t.serDate > addedTo)) return false
  if (appliedFilters.filterProjects.length && !appliedFilters.filterProjects.includes(t.rawProjectName)) return false
  if (appliedFilters.filterHandlers.length && !appliedFilters.filterHandlers.includes(t.rawHandler)) return false
  if (
    appliedFilters.filterTitle &&
    !(t.rawTitle || '').toLowerCase().includes(appliedFilters.filterTitle.trim().toLowerCase())
  )
    return false
  if (
    appliedFilters.filterUrl &&
    !(t.rawUrl || '').toLowerCase().includes(appliedFilters.filterUrl.trim().toLowerCase())
  )
    return false
  return true
}

/**
 * 将筛选栏编辑中的条件同步为生效条件，避免条件变更立即影响列表
 */
function syncAppliedFilters() {
  Object.assign(appliedFilters, {
    ...filters,
    dateRange: filters.dateRange ? ([...filters.dateRange] as [Date, Date]) : filters.dateRange,
    filterAddedDate: [...(filters.filterAddedDate || [])],
    filterProjects: [...filters.filterProjects],
    filterHandlers: [...filters.filterHandlers],
  })
}

/**
 * 筛选栏回显持久化条件后同步为生效条件，只同步不查库，日期范围已按存储值加载
 */
function onFilterRestored() {
  syncAppliedFilters()
  computeStatsCache()
}

const matchedTasks = computed<DisplayTask[]>(() => {
  return allDisplayTasks.value.filter((t) => matchesKeyword(t) && matchesFilters(t))
})

const activeTasks = computed<DisplayTask[]>(() => matchedTasks.value.filter((t) => !t.serPostponed))

// 同步与 AI 审查范围包含延期任务，仅统计、导出、删除排除
const syncableTasks = computed<DisplayTask[]>(() => matchedTasks.value)

const displayTasks = computed<DisplayTask[]>(() => matchedTasks.value)

const selectedTasks = computed(() => selection.value)

const pagedTasks = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return displayTasks.value.slice(start, start + pageSize.value)
})

const toolbarState = computed<ToolbarState>(() => ({
  selectedCount: selection.value.length,
  pageCount: pagedTasks.value.length,
  rangeCount: displayTasks.value.length,
  totalCount: allDisplayTasks.value.length,
  syncing: syncing.value || syncingAll.value,
  checking: checking.value || checkingAll.value,
  exporting: isExporting.value,
  backingUp: backingUp.value,
  autoSyncEnabled: autoSyncEnabled.value,
  lastSyncTime: lastSyncTime.value,
  backupEnabled: backupEnabled.value,
  lastBackupTime: lastBackupTime.value,
}))

const statsCache = shallowRef<{
  stats: {
    totalTasks: number
    totalSelfHours: number
    totalEstHours: number
    totalScore: number
    evaluationGood: number
    evaluationPass: number
    evaluationOther: number
  }
  detailRows: Array<{
    label: string
    prev: string | number
    curr: string | number
    growth: number | null
  }>
  chartData: Array<{ label: string; prev: number; curr: number }>
} | null>(null)

function computeStatsCache() {
  const tasks = activeTasks.value
  const prevTasks = prevDays.value.flatMap((d) => d.tasks).filter((t) => !t.serPostponed)

  const stats = computeTaskStats(
    tasks,
    tasks.map((t) => t.remote),
  )
  const prevStats = computeTaskStats(
    prevTasks,
    prevTasks.map((t) => t.remote),
  )

  statsCache.value = {
    stats,
    detailRows: [
      {
        label: '任务数量',
        prev: prevStats.totalTasks,
        curr: stats.totalTasks,
        growth: pct(stats.totalTasks, prevStats.totalTasks),
      },
      {
        label: '平台自评时长',
        prev: prevStats.totalSelfHours + 'h',
        curr: stats.totalSelfHours + 'h',
        growth: pct(stats.totalSelfHours, prevStats.totalSelfHours),
      },
      {
        label: '平台预估时长',
        prev: prevStats.totalEstHours + 'h',
        curr: stats.totalEstHours + 'h',
        growth: pct(stats.totalEstHours, prevStats.totalEstHours),
      },
      {
        label: '好',
        prev: prevStats.evaluationGood,
        curr: stats.evaluationGood,
        growth: pct(stats.evaluationGood, prevStats.evaluationGood),
      },
      {
        label: '合格',
        prev: prevStats.evaluationPass,
        curr: stats.evaluationPass,
        growth: pct(stats.evaluationPass, prevStats.evaluationPass),
      },
      {
        label: '其他',
        prev: prevStats.evaluationOther,
        curr: stats.evaluationOther,
        growth: pct(stats.evaluationOther, prevStats.evaluationOther),
      },
    ],
    chartData: [
      { label: '任务数', prev: prevStats.totalTasks, curr: stats.totalTasks },
      { label: '自评时长', prev: prevStats.totalSelfHours, curr: stats.totalSelfHours },
      { label: '预估时长', prev: prevStats.totalEstHours, curr: stats.totalEstHours },
      { label: '评价好', prev: prevStats.evaluationGood, curr: stats.evaluationGood },
      { label: '评价合格', prev: prevStats.evaluationPass, curr: stats.evaluationPass },
      { label: '评价其他', prev: prevStats.evaluationOther, curr: stats.evaluationOther },
    ],
  }
}

const stats = computed(
  () =>
    statsCache.value?.stats || {
      totalTasks: 0,
      totalSelfHours: 0,
      totalEstHours: 0,
      totalScore: 0,
      evaluationGood: 0,
      evaluationPass: 0,
      evaluationOther: 0,
    },
)
const detailRows = computed(() => statsCache.value?.detailRows || [])
const chartData = computed(() => statsCache.value?.chartData || [])

const pageSizeList = computed(() => PAGE_SIZE_LIST)

const containsToday = computed(() => {
  if (!appliedFilters.dateRange?.[0] || !appliedFilters.dateRange?.[1]) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(appliedFilters.dateRange[0])
  start.setHours(0, 0, 0, 0)
  const end = new Date(appliedFilters.dateRange[1])
  end.setHours(23, 59, 59, 999)
  return today >= start && today <= end
})
// #endregion

// #region 辅助函数

function pct(cur: number, prev: number): number | null {
  return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
}

function openPostponeDialog(task: DisplayTask) {
  const formData = {
    postponed: task.serPostponed || false,
    postponedReason: task.serPostponedReason || '',
  }
  postponeModal.open(
    { form: formData },
    {
      confirm: (form: { postponed: boolean; postponedReason: string }) => {
        task.serPostponed = form.postponed
        task.serPostponedReason = form.postponedReason
        markDirty()
        logStore.addLog('success', '已更新执行延期标记')
      },
    },
  )
}

function openPriorityDialog(task: DisplayTask) {
  const formData = {
    priority: task.serPriority || null,
  }
  priorityModal.open(
    { form: formData },
    {
      confirm: (form: { priority: 'high' | 'medium' | 'low' | null }) => {
        task.serPriority = form.priority
        markDirty()
        logStore.addLog('success', '已更新执行优先级')
      },
    },
  )
}

function openTimeLimitDialog(task: DisplayTask) {
  const formData = {
    timeLimit: task.serTimeLimit || null,
  }
  timeLimitModal.open(
    { form: formData },
    {
      confirm: (form: { timeLimit: 'today' | 'temp' | null }) => {
        task.serTimeLimit = form.timeLimit
        markDirty()
        logStore.addLog('success', '已更新限时任务')
      },
    },
  )
}
// #endregion

// #region 数据加载与筛选
const DATE_RANGE_STORAGE_KEY = 'historyDateRange'

/**
 * 读取上次保存的日期范围并回显，无有效记录时保持默认范围
 */
async function restoreDateRange() {
  const saved = await ipc.storeGet(DATE_RANGE_STORAGE_KEY)
  if (!Array.isArray(saved) || saved.length !== 2) return
  const start = new Date(saved[0])
  const end = new Date(saved[1])
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return
  filters.dateRange = [start, end]
}

/**
 * 保存当前生效的日期范围，下次进入页面时自动回显
 */
function persistDateRange() {
  // 清空日期选择器时值为 null，此时保留上次记录
  const [start, end] = appliedFilters.dateRange || []
  if (!start || !end) return
  ipc.storeSet(DATE_RANGE_STORAGE_KEY, [start.toISOString(), end.toISOString()])
}

const PAGINATION_STORAGE_KEY = 'historyPagination'
// 回显完成前不落盘，避免加载时的页码归位覆盖上次记录
let paginationRestored = false

/**
 * 回显上次的页码与每页条数，页码超出总页数时归位到最后
 */
async function restorePagination() {
  const saved = await ipc.storeGet(PAGINATION_STORAGE_KEY)
  const size = Number(saved?.pageSize)
  if (PAGE_SIZE_LIST.includes(size)) pageSize.value = size
  const maxPage = Math.max(1, Math.ceil(displayTasks.value.length / pageSize.value))
  const page = Math.floor(Number(saved?.currentPage))
  if (page > 0) currentPage.value = Math.min(page, maxPage)
  paginationRestored = true
}

/**
 * 保存当前页码与每页条数，下次进入页面时自动回显
 */
function persistPagination() {
  if (!paginationRestored) return
  ipc.storeSet(PAGINATION_STORAGE_KEY, {
    currentPage: currentPage.value,
    pageSize: pageSize.value,
  })
}

watch([currentPage, pageSize], persistPagination)

/**
 * 用文件日期补齐任务日期，保证表格展示、排序与日期筛选一致
 * @param {HistoryDay[]} days 历史数据
 */
function attachTaskDates(days: HistoryDay[]) {
  for (const day of days) {
    for (const task of day.tasks) task.serDate = day.date
  }
}

async function loadRange() {
  if (!appliedFilters.dateRange?.[0] || !appliedFilters.dateRange?.[1]) return
  currentPage.value = 1
  const start = formatYMD(appliedFilters.dateRange[0])
  const end = formatYMD(appliedFilters.dateRange[1])

  // 切换范围前先落盘未保存的修改，避免数据丢失
  await flushPendingChanges()
  dirty.value = false

  // 计算上一周期范围
  const duration =
    Math.round((appliedFilters.dateRange[1].getTime() - appliedFilters.dateRange[0].getTime()) / 86400000) + 1
  const prevEnd = addDays(appliedFilters.dateRange[0], -1)
  const prevStart = addDays(prevEnd, -(duration - 1))
  prevRangeLabel.value = `${formatYMD(prevStart)} ~ ${formatYMD(prevEnd)}`

  const [cur, prev] = await Promise.all([
    ipc.queryHistory({ startDate: start, endDate: end }),
    ipc.queryHistory({ startDate: formatYMD(prevStart), endDate: formatYMD(prevEnd) }),
  ])
  loadedDays.value = cur
  prevDays.value = prev
  attachTaskDates(loadedDays.value)
  selection.value = []
  rebuildAllDisplayTasks()
  computeStatsCache()
}

/**
 * 执行搜索：先同步筛选栏条件为生效条件，有关键字且选全部历史时查全量，其余按日期范围取数
 */
async function onSearch() {
  if (searching.value) return
  searching.value = true
  try {
    syncAppliedFilters()
    currentPage.value = 1
    persistDateRange()

    const kw = appliedFilters.keyword.trim()
    if (kw && appliedFilters.searchScope === 'all') {
      // 切换数据前先落盘当前范围的未保存修改
      await flushPendingChanges()
      const days = await ipc.queryHistory({ keyword: kw })
      attachTaskDates(days)
      loadedDays.value = days
      // 全量搜索无有效的上期对比对象，清空上期数据避免误导
      prevDays.value = []
      prevRangeLabel.value = ''
      selection.value = []
      rebuildAllDisplayTasks()
      computeStatsCache()
    } else if (appliedFilters.dateRange?.[0] && appliedFilters.dateRange?.[1]) {
      await loadRange()
    }
    restartAutoSync(true)
  } finally {
    searching.value = false
  }
}

onMounted(async () => {
  // 先回显上次保存的日期范围，再基于该范围加载数据
  await restoreDateRange()
  // 初始生效条件对齐回显的日期范围，筛选栏回显完成后还会再次同步
  syncAppliedFilters()
  const [, bt, backupVal, st] = await Promise.all([
    loadRange(),
    ipc.storeGet('lastBackupTime'),
    ipc.getSetting('history.backupEnabled'),
    ipc.storeGet('lastAutoSyncTime'),
  ])
  // 数据就位后再回显分页，避免 loadRange 的页码归位覆盖上次记录
  await restorePagination()
  lastBackupTime.value = bt ? new Date(bt).toLocaleString() : ''
  backupEnabled.value = !!backupVal
  lastSyncTime.value = st ? new Date(st).toLocaleString() : ''
  restartAutoSync()

  // 设置中修改自动同步开关或间隔后重启定时器，无需重新进页即可生效
  unsubscribeAutoSync = ipc.onAutoSyncSettingsChanged(() => restartAutoSync(true))

  unsubscribeBackup = ipc.onBackupCompleted(async () => {
    const bt = await ipc.storeGet('lastBackupTime')
    lastBackupTime.value = bt ? new Date(bt).toLocaleString() : ''
  })

  // 关窗前兜底落盘（渲染进程销毁前 IPC 已入队主进程）
  window.addEventListener('beforeunload', handleBeforeUnload)
})

function handleBeforeUnload() {
  if (dirty.value) {
    flushPendingChanges()
  }
}

onBeforeUnmount(() => {
  abortSync.value = true
  abortCheck.value = true
  stopAutoSync()
  if (unsubscribeAutoSync) unsubscribeAutoSync()
  if (unsubscribeBackup) unsubscribeBackup()
  window.removeEventListener('beforeunload', handleBeforeUnload)
  // 取消在途防抖并立即落盘，减少关窗/切页时的数据丢失窗口
  if (dirty.value) {
    flushPendingChanges()
  }
})
// #endregion

// #region 自动保存
// 写盘串行队列：删除与在途 flush 并发执行时避免过期内存数据回退
let writeChain: Promise<void> = Promise.resolve()

/**
 * 将写盘操作加入串行队列，保证按调用顺序落盘
 * @param fn 写盘函数
 * @returns 写盘结果 Promise
 */
function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn)
  writeChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

let saveDebounce: ReturnType<typeof setTimeout> | null = null
// 内存结构版本号，删除时递增，用于检测在途 flush 期间的结构变更
let dataVersion = 0
watch(dirty, (v) => {
  if (!v) return
  if (saveDebounce) clearTimeout(saveDebounce)
  saveDebounce = setTimeout(() => flushChanges(), 800)
})

function markDirty() {
  dirty.value = true
}

/**
 * 落盘待保存的修改：取消在途防抖后立即写入，避免切换范围或搜索时丢失
 */
async function flushPendingChanges() {
  if (!dirty.value) return
  if (saveDebounce) {
    clearTimeout(saveDebounce)
    saveDebounce = null
  }
  await flushChanges(true)
}

function onSelectionChange(sel: any[]) {
  selection.value = sel
}

/**
 * 按生效的搜索关键字过滤日期数据
 * @param {HistoryDay[]} days 日期数据列表
 * @returns {HistoryDay[]} 过滤后的日期数据列表
 */
function filterDaysByKeyword(days: HistoryDay[]): HistoryDay[] {
  if (!appliedFilters.keyword.trim()) return days
  return days
    .map((d) => ({
      ...d,
      tasks: d.tasks.filter((t) => taskMatchesKeyword(t, appliedFilters.keyword)),
    }))
    .filter((d) => d.tasks.length > 0)
}

async function flushChanges(silent = false) {
  // 在途 flush 期间内存结构可能被删除操作修改，需用最新内存重新合并，最多重试两次
  for (let attempt = 0; attempt < 3; attempt++) {
    const versionAtStart = dataVersion
    loadedDays.value = await enqueueWrite(() => flushHistoryChanges(loadedDays.value))
    if (dataVersion === versionAtStart) break
  }
  // 关键字查全部时落盘会合并磁盘全量数据，重新过滤保持表格与统计口径一致
  if (appliedFilters.searchScope === 'all' && appliedFilters.keyword.trim()) {
    loadedDays.value = filterDaysByKeyword(loadedDays.value)
  }
  dirty.value = false
  rebuildAllDisplayTasks()
  computeStatsCache()
  if (!silent) {
    logStore.addLog('success', '已保存')
  }
  logStore.addLog('info', `保存历史: ${loadedDays.value.length} 天`)
}

async function handleSaveRange(silent = false) {
  try {
    await flushChanges(silent)
  } catch (e: any) {
    logStore.addLog('error', '保存失败: ' + (e.message || ''))
  }
}
// #endregion

// #region 删除任务
/**
 * 读取某日期的完整任务数据；删除须基于完整数据写回，避免搜索子集覆盖磁盘
 * @param {string} date 日期（YYYY-MM-DD）
 * @returns {Promise<any[]>} 完整任务列表，文件不存在时为空数组
 */
async function loadFullTasks(date: string): Promise<any[]> {
  const day = await ipc.getHistoryDate(date)
  return day?.tasks || []
}

async function handleDeleteRange() {
  if (!loadedDays.value.length) return
  const searchMode = appliedFilters.searchScope === 'all' && !!appliedFilters.keyword.trim()
  try {
    await ElMessageBox.confirm(
      searchMode
        ? `确定删除 ${loadedDays.value.length} 天中当前筛选出的非延期任务？延期任务将保留。`
        : `确定删除 ${loadedDays.value.length} 天的全部非延期历史任务？延期任务将保留。`,
      '确认删除',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    )
    // 范围内删除仅针对非延期任务，延期任务保留，可经「删除选中」或行内删除移除
    const saveBatch: Array<{ date: string; data: HistoryDay }> = []
    const deleteDates: string[] = []
    for (const day of loadedDays.value) {
      // 删除非延期部分；延期与未匹配任务保留
      const deleteIds = new Set(day.tasks.filter((t: any) => !t.serPostponed).map((t: any) => t.serId))
      const fullTasks = await loadFullTasks(day.date)
      const remaining = fullTasks.filter((t: any) => !deleteIds.has(t.serId))
      if (remaining.length === 0) {
        deleteDates.push(day.date)
      } else {
        saveBatch.push({ date: day.date, data: { ...day, tasks: remaining } })
      }
    }
    if (saveBatch.length > 0) {
      await enqueueWrite(() => ipc.batchSaveHistory(saveBatch))
    }
    for (const date of deleteDates) {
      await enqueueWrite(() => ipc.deleteHistoryDate(date))
    }
    logStore.addLog('success', '已删除')
    logStore.addLog('info', `删除历史: ${loadedDays.value.length} 天`)
    loadedDays.value = []
    selection.value = []
    // 结构变更后递增版本号，通知在途 flush 使用最新内存重新合并
    dataVersion++
    rebuildAllDisplayTasks()
    computeStatsCache()
  } catch {
    // 取消
  }
}

async function handleDeleteSelected() {
  const tasks = selection.value
  if (!tasks.length) return
  try {
    await ElMessageBox.confirm(`确定删除 ${tasks.length} 条选中任务？`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    const taskIds = new Set(tasks.map((t) => t.serId))

    const saveBatch: Array<{ date: string; data: HistoryDay }> = []
    const deleteDates: string[] = []

    for (const day of loadedDays.value) {
      const before = day.tasks.length
      day.tasks = day.tasks.filter((t) => !taskIds.has(t.serId))
      if (day.tasks.length < before) {
        // 基于磁盘完整数据删除，避免搜索过滤子集覆盖丢失同日期未匹配任务
        const fullTasks = await loadFullTasks(day.date)
        const remaining = fullTasks.filter((t: any) => !taskIds.has(t.serId))
        if (remaining.length === 0) {
          deleteDates.push(day.date)
        } else {
          saveBatch.push({ date: day.date, data: { ...day, tasks: remaining } })
        }
      }
    }

    // 批量保存和删除（入串行队列，避免与在途 flush 竞争）
    if (saveBatch.length > 0) {
      await enqueueWrite(() => ipc.batchSaveHistory(saveBatch))
    }
    for (const date of deleteDates) {
      await enqueueWrite(() => ipc.deleteHistoryDate(date))
    }

    loadedDays.value = loadedDays.value.filter((d) => d.tasks.length > 0)
    selection.value = []
    // 结构变更后递增版本号，通知在途 flush 使用最新内存重新合并
    dataVersion++
    rebuildAllDisplayTasks()
    computeStatsCache()
    logStore.addLog('success', `已删除 ${tasks.length} 条`)
    logStore.addLog('info', `删除选中任务: ${tasks.length} 条`)
  } catch {
    // 取消
  }
}

async function removeTask(task: any) {
  for (const day of loadedDays.value) {
    const idx = day.tasks.findIndex((t) => t.serId === task.serId)
    if (idx >= 0) {
      day.tasks.splice(idx, 1)
      // 结构变更后递增版本号，通知在途 flush 使用最新内存重新合并
      dataVersion++
      // 基于磁盘完整数据删除，避免搜索子集覆盖导致同日期未匹配任务丢失
      const fullTasks = await loadFullTasks(day.date)
      const remaining = fullTasks.filter((t: any) => t.serId !== task.serId)
      if (remaining.length === 0) {
        await enqueueWrite(() => ipc.deleteHistoryDate(day.date))
        loadedDays.value = loadedDays.value.filter((d) => d.date !== day.date)
      } else {
        await enqueueWrite(() => ipc.saveHistoryDate(day.date, { ...day, tasks: remaining }))
      }
      break
    }
  }
  // 同步移除选中引用，避免残留已删任务导致后续"删除选中"误报数量
  selection.value = selection.value.filter((t) => t.serId !== task.serId)
  rebuildAllDisplayTasks()
  computeStatsCache()
  logStore.addLog('success', '已删除')
  logStore.addLog('info', `删除任务: ${task.serId}`)
}
// #endregion

// #region AI 审查
async function doAiReview(tasks: Array<{ task: HistoryTaskItem }>) {
  const { cookie, handlerName, departmentName, aiEnabled } = store.config
  if (!cookie) {
    logStore.addLog('warning', '请先在设置中填写 Cookie')
    return { count: 0, passed: 0, failed: 0 }
  }
  if (!aiEnabled) {
    logStore.addLog('warning', 'AI 审查未启用，请先在设置中开启')
    return { count: 0, passed: 0, failed: 0 }
  }

  const ttv: TaskToValidate[] = tasks.map(({ task }) => ({
    rawSeq: String(task.rawSeq),
    rawProjectName: task.rawProjectName,
    rawTitle: task.rawTitle,
    rawScore: task.rawScore,
    rawEstimatedHours: task.rawEstimatedHours,
    rawRemark: task.rawRemark,
    rawUrl: task.rawUrl,
    taskDate: (task as any).serDate,
  }))

  let count = 0
  let passed = 0
  let failed = 0
  const total = tasks.length

  await reviewBatch(
    ttv,
    { cookie, handlerName, departmentName, aiEnabled: true },
    {
      signal: {
        // getter 把中止信号 ref 映射为 aborted 属性
        get aborted() {
          return abortCheck.value
        },
      },
      onTaskStart: (i, total, t) => {
        logStore.addLog('info', `[${i + 1}/${total}] AI 审查: ${t.rawProjectName} - ${t.rawTitle}`)
      },
      // 每条完成后立即写回任务对象并输出结果日志，结果紧随开始日志
      onTaskComplete: (o) => {
        const { task } = tasks[o.index]
        if (o.error) {
          logStore.addLog('error', `[${o.index + 1}/${total}] 处理异常: ${o.error.message}`)
          return
        }
        if (o.result?.serError) {
          logStore.addLog('error', `[${o.index + 1}/${total}] 平台数据获取失败: ${o.result.serError}`)
        }
        if (o.result?.remote) {
          task.remote = o.result.remote
          if (task.serSyncStatus === 'none') task.serSyncStatus = 'synced'
        }
        count++
        task.serAiConclusion = o.aiConclusion ?? null
        if (o.aiConclusion) {
          if (isAiReviewPassed(o.aiConclusion)) passed++
          else failed++
          if (o.aiPrompt) logStore.addLog('info', `[${o.index + 1}/${total}] AI 输入: ${o.aiPrompt}`)
          if (o.aiReasoning) logStore.addLog('info', `[${o.index + 1}/${total}] AI 思考: ${o.aiReasoning}`)
          logStore.addLog(
            isAiReviewPassed(o.aiConclusion) ? 'success' : 'warning',
            `[${o.index + 1}/${total}] AI 审查: ${o.aiConclusion}`,
          )
        } else if (o.aiError) {
          logStore.addLog('warning', `[${o.index + 1}/${total}] AI 审查失败: ${o.aiError}`)
        }
      },
    },
  )

  return { count, passed, failed }
}

function buildSyncNotifyBody(synced: number, total: number): string {
  const failed = total - synced
  return failed > 0 ? `成功 ${synced} 条，失败 ${failed} 条` : `成功 ${synced}/${total} 条`
}

function buildCheckNotifyBody(passed: number, failed: number, total: number): string {
  const skipped = total - passed - failed
  let body = `通过 ${passed}/${total} 条`
  if (failed > 0) body += `，未通过 ${failed} 条`
  if (skipped > 0) body += `，异常 ${skipped} 条`
  return body
}

async function handleAiReviewSelected() {
  const tasks = selection.value
  if (!tasks.length) return
  checking.value = true
  abortCheck.value = false
  try {
    const items = tasks.map((t) => ({ task: t }))
    const res = await doAiReview(items)
    if (res.count) {
      dirty.value = true
      await handleSaveRange(true)
      if (!abortCheck.value) {
        logStore.addLog('success', `AI 审查完成: ${res.count} 条`)
        await maybeShowSysNotification(
          'notification.onCheckCompleted',
          'AI 审查完成',
          buildCheckNotifyBody(res.passed, res.failed, items.length),
        )
      }
    }
  } finally {
    checking.value = false
  }
}

async function handleAiReviewRange() {
  const tasks = syncableTasks.value
  if (!tasks.length) return
  checkingAll.value = true
  abortCheck.value = false
  try {
    const items = tasks.map((t) => ({ task: t }))
    const res = await doAiReview(items)
    if (res.count) {
      dirty.value = true
      await handleSaveRange(true)
      if (!abortCheck.value) {
        logStore.addLog('success', `AI 审查完成: ${res.count} 条`)
        await maybeShowSysNotification(
          'notification.onCheckCompleted',
          'AI 审查完成',
          buildCheckNotifyBody(res.passed, res.failed, items.length),
        )
      }
    }
  } finally {
    checkingAll.value = false
  }
}
// #endregion

// #region 编辑与详情

function rebuildRaw(task: HistoryTaskItem): string {
  const scoreBracket = task.rawScore ? `【${task.rawScore}】` : ''
  return `${task.rawSeq}.${task.rawProjectName}-【${task.rawTitle}-${task.rawHandler}】 ${task.rawUrl}${scoreBracket}`
}

function openEditDialog(row: DisplayTask) {
  const task = JSON.parse(JSON.stringify(row))
  editModal.open(
    { task },
    {
      confirm: (updated: DisplayTask) => {
        for (const day of loadedDays.value) {
          const t = day.tasks.find((x) => x.serId === updated.serId)
          if (t) {
            Object.assign(t, updated)
            t.rawText = rebuildRaw(t)
            // 内容已变更，旧的 AI 结论不再可信
            t.serAiConclusion = null
            break
          }
        }
        markDirty()
        rebuildAllDisplayTasks()
        computeStatsCache()
        logStore.addLog('success', '已修改')
      },
    },
  )
}

function showDetail(row: any) {
  if (!row.remote && !row.serAiConclusion) return
  detailModal.open({
    result: { serTaskId: row.serWorkPackageId || '', remote: row.remote ?? undefined },
    aiConclusion: row.serAiConclusion ?? null,
  })
}
// #endregion

// #region 同步
async function handleSync() {
  const tasks = selectedTasks.value
  if (!tasks.length) return
  const cookie = store.config.cookie
  if (!cookie) {
    logStore.addLog('warning', '请先在设置中填写 Cookie')
    return
  }

  syncing.value = true
  abortSync.value = false
  let synced = 0
  try {
    // 串行逐条同步：每条开始日志与结果日志紧随其后，停止同步在条间生效
    for (let index = 0; index < tasks.length && !abortSync.value; index++) {
      const task = tasks[index]
      logStore.addLog('info', `[${index + 1}/${tasks.length}] 同步: ${task.rawProjectName} - ${task.rawTitle}`)

      let r: any = null
      try {
        const part = await ipc.syncHistoryTasks([JSON.parse(JSON.stringify(task))], cookie)
        r = part?.[0] ?? null
      } catch {
        r = null
      }

      if (!r) {
        logStore.addLog('error', `[${index + 1}/${tasks.length}] 同步失败: 无返回`)
        continue
      }

      let found: any = null
      for (const day of loadedDays.value) {
        const t = day.tasks.find((x) => x.serId === r.taskId)
        if (t) {
          found = t
          break
        }
      }
      if (!found) continue

      // 远程数据缺失时视为同步失败，保持原状态并输出告警
      if (!r.remote) {
        const reason = r.error ? `同步失败: ${r.error}` : '同步失败: 无法获取远程任务数据'
        logStore.addLog('warning', `[${index + 1}/${tasks.length}] ${reason}`)
        continue
      }
      const localTitle = found.rawTitle
      const localProject = found.rawProjectName
      found.rawTitle = r.remote.subject || found.rawTitle
      found.rawProjectName = r.remote._embedded?.project?.name || found.rawProjectName
      // 远程与本地不一致时以平台数据为准
      const changed = found.rawTitle !== localTitle || found.rawProjectName !== localProject
      found.serSyncStatus = 'synced'
      if (changed) {
        logStore.addLog('warning', `[${index + 1}/${tasks.length}] 平台数据与本地不一致，已采用平台数据覆盖`)
      }
      found.remote = r.remote
      found.serWorkPackageId = r.workPackageId ?? found.serWorkPackageId
      found.serSyncedAt = new Date().toISOString()
      found.serUpdatedAt = new Date().toISOString()
      synced++
      logStore.addLog('success', `[${index + 1}/${tasks.length}] 已同步`)
    }

    if (synced > 0) {
      dirty.value = true
      rebuildAllDisplayTasks()
      computeStatsCache()
      await handleSaveRange(true)
    }
    if (!abortSync.value) {
      logStore.addLog('info', `同步完成: ${synced}/${tasks.length} 条`)
      await maybeShowSysNotification(
        'notification.onSyncCompleted',
        '同步完成',
        buildSyncNotifyBody(synced, tasks.length),
      )
    } else {
      logStore.addLog('warning', '同步已停止')
    }
  } catch (e: any) {
    logStore.addLog('error', '同步失败: ' + (e.message || ''))
  } finally {
    syncing.value = false
  }
}

async function handleSyncAll() {
  const tasks = syncableTasks.value
  if (!tasks.length) return
  const cookie = store.config.cookie
  if (!cookie) {
    logStore.addLog('warning', '请先在设置中填写 Cookie')
    return
  }

  const prevSelection = selection.value
  selection.value = tasks
  syncingAll.value = true
  abortSync.value = false
  try {
    await handleSync()
  } finally {
    // 恢复进入前的选择，避免清空用户已勾选的任务
    selection.value = prevSelection
    syncingAll.value = false
  }
}

// #endregion

// #region 导出与复制
function mapExportTasks(tasks: HistoryTaskItem[]) {
  // 导出口径：排除延期任务与重复任务链接（保留首次出现的链接）
  const seenUrls = new Set<string>()
  return tasks
    .filter((t) => t.rawUrl && !t.serPostponed)
    .filter((t) => {
      if (seenUrls.has(t.rawUrl)) return false
      seenUrls.add(t.rawUrl)
      return true
    })
    .map((t) => ({
      url: t.rawUrl,
      projectName: t.rawProjectName,
      title: t.rawTitle,
      score: t.rawScore,
      estimatedHours: t.rawEstimatedHours,
    }))
}

async function doExport(tasks: HistoryTaskItem[]) {
  const mapped = mapExportTasks(tasks)
  if (!mapped.length) {
    logStore.addLog('warning', '所选任务无有效链接，无法导出')
    return
  }
  const excluded = tasks.length - mapped.length
  if (excluded > 0) {
    logStore.addLog('info', `已排除延期/重复链接任务 ${excluded} 条`)
  }

  const result = await ipc.saveFile({
    defaultName: `历史任务_${formatYMD(new Date())}.xlsx`,
    filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }],
  })
  if (!result) return

  isExporting.value = true
  try {
    const ret = await ipc.fillExcelTemplate({
      tasks: mapped,
      targetPath: result,
      handlerName: store.config.handlerName,
      cookie: store.config.cookie,
      templatePath: store.config.templatePath || undefined,
    })

    if (ret.success) {
      logStore.addLog('success', '导出成功')
      logStore.addLog('info', `历史任务导出: ${result}`)
    } else {
      logStore.addLog('error', '导出失败: ' + (ret.error || ''))
    }
  } catch (e: any) {
    logStore.addLog('error', '导出异常: ' + (e.message || ''))
  } finally {
    isExporting.value = false
  }
}

async function handleExportSelected() {
  await doExport(selectedTasks.value)
}

async function handleExportRange() {
  await doExport(activeTasks.value)
}

function doCopyTask(withEst: boolean) {
  const tasks = selectedTasks.value.length ? selectedTasks.value : pagedTasks.value
  if (!tasks.length) return
  const lines = tasks.map((t, i) => {
    // 按字段重建行文本，避免基于 raw 的正则替换误伤标题括号
    const scoreBracket = t.rawScore ? `【${t.rawScore}】` : ''
    const estTag = withEst && t.remote?.estimatedTime ? `【${convertIso8601ToHours(t.remote.estimatedTime)}】` : ''
    return `${i + 1}.${estTag}${t.rawProjectName}-【${t.rawTitle}-${t.rawHandler}】 ${t.rawUrl}${scoreBracket}`
  })
  navigator.clipboard.writeText(lines.join('\n')).then(
    () => logStore.addLog('success', '已复制任务'),
    () => logStore.addLog('error', '复制失败'),
  )
  logStore.addLog('info', `已复制任务 (${tasks.length} 条)`)
}
// #endregion

// #region 备份
async function handleBackupNow() {
  backingUp.value = true
  try {
    const dirs = (await ipc.getSetting('history.backupDirectories')) || []
    const ret = await ipc.backupNow(JSON.parse(JSON.stringify(dirs)))
    if (ret?.success) {
      lastBackupTime.value = ret.time ? new Date(ret.time).toLocaleString() : new Date().toLocaleString()
      logStore.addLog('success', `备份完成: ${ret.count}/${ret.total} 个目录`)
    } else {
      logStore.addLog('warning', ret?.message || '备份失败')
    }
  } catch (e: any) {
    logStore.addLog('error', '备份异常: ' + (e.message || ''))
  } finally {
    backingUp.value = false
  }
}

async function handleRestoreBackup() {
  try {
    const { count } = await ipc.restoreHistoryFromDir()
    if (count > 0) {
      logStore.addLog('success', `已从备份目录恢复 ${count} 个历史文件`)
      await loadRange()
    } else {
      logStore.addLog('info', '备份目录无有效历史文件')
    }
  } catch (e: any) {
    logStore.addLog('error', '恢复失败: ' + (e.message || ''))
  }
}
// #endregion

// #region 自动同步
async function runAutoSync() {
  if (autoSyncRunning.value) return
  if (!syncableTasks.value.length) return

  const enabled = await ipc.getSetting('history.autoSyncEnabled')
  if (!enabled) return

  autoSyncRunning.value = true
  autoSyncEnabled.value = true
  logStore.addLog('info', '自动同步: 开始同步范围内任务...')

  const prevSelection = [...selection.value]

  try {
    await handleSyncAll()

    await ipc.storeSet('lastAutoSyncTime', new Date().toISOString())
    lastSyncTime.value = new Date().toLocaleString()
    logStore.addLog('success', '自动同步完成')
  } catch (e: any) {
    logStore.addLog('error', '自动同步异常: ' + (e.message || ''))
  } finally {
    selection.value = prevSelection
    autoSyncRunning.value = false
  }
}

const autoSyncSchedule = createAutoSyncSchedule({
  isEligible: () => containsToday.value,
  isEnabled: async () => {
    const enabled = await ipc.getSetting('history.autoSyncEnabled')
    autoSyncEnabled.value = !!enabled
    return !!enabled
  },
  getIntervalMs: async () => {
    const intervalMin = (await ipc.getSetting('history.autoSyncInterval')) || 5
    return intervalMin * 60 * 1000
  },
  getLastRunAt: () => ipc.storeGet('lastAutoSyncTime'),
  run: () => runAutoSync(),
})

function stopAutoSync() {
  autoSyncSchedule.stop()
}

// 重启自动同步定时器，skipImmediate 为 true 时跳过页面加载的周期判断
async function restartAutoSync(skipImmediate = false) {
  autoSyncEnabled.value = false
  await autoSyncSchedule.restart(skipImmediate)
}
// #endregion

// #region 打断操作
function handleAbortSync() {
  abortSync.value = true
}

function handleAbortCheck() {
  abortCheck.value = true
}
// #endregion

// #region 命令分发
function handleDeleteCmd(cmd: string) {
  if (cmd === 'selected') handleDeleteSelected()
  else if (cmd === 'range') handleDeleteRange()
}

// 同步与 AI 审查共用一个下拉，有勾选时作用于选中，无勾选时作用于当前范围
function handleSyncCheckCmd(cmd: string) {
  const byRange = selection.value.length === 0
  if (cmd === 'sync') {
    if (byRange) handleSyncAll()
    else handleSync()
  } else if (cmd === 'aiCheck') {
    if (byRange) handleAiReviewRange()
    else handleAiReviewSelected()
  } else if (cmd === 'syncAiCheck') {
    handleSyncThenAiReview(byRange)
  }
}

// 先同步再 AI 审查，同步被停止时不再继续审查
async function handleSyncThenAiReview(byRange: boolean) {
  if (byRange) await handleSyncAll()
  else await handleSync()
  if (abortSync.value) return
  if (byRange) await handleAiReviewRange()
  else await handleAiReviewSelected()
}

function handleExportCmd(cmd: string) {
  if (cmd === 'selected') handleExportSelected()
  else if (cmd === 'range') handleExportRange()
}

function handleBackupCmd(cmd: string) {
  if (cmd === 'backup') handleBackupNow()
  else if (cmd === 'restore') handleRestoreBackup()
}

function handleCopyCmd(cmd: string) {
  doCopyTask(cmd === 'withEst')
}
// #endregion
</script>

<style scoped>
.page-history {
  height: 100%;
  display: flex;
  flex-direction: column;
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
.stats-detail-btn {
  margin-left: auto;
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
.up {
  color: var(--el-color-success);
}
.down {
  color: var(--el-color-danger);
}
.stats-detail {
  padding: 0 var(--app-space-2);
}
.drawer-subtitle {
  margin-left: 8px;
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
  font-weight: normal;
}
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: var(--app-space-2) var(--app-space-3);
  flex-shrink: 0;
}
</style>

<!-- 抽屉拖拽调宽样式：抽屉 teleport 到 body 后 scoped 无法命中，须用非 scoped -->
<style>
.drawer-resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  cursor: ew-resize;
  background: transparent;
  z-index: 10;
}
.drawer-resize-handle:hover {
  background: var(--el-color-primary-light-5);
}
</style>
