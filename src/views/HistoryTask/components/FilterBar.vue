<!--
 * @Author: zhengrenfu
 * @Date: 2026-09-14 10:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-10-30 09:58:14
 * @FilePath: /src/views/HistoryTask/components/FilterBar.vue
 * @Description: 历史任务筛选栏组件，常驻区做粗略筛选，展开区做精细筛选；条件变更不触发查询，点击搜索按钮后才执行
-->
<template>
  <div class="filter-bar-wrap">
    <div class="filter-bar">
      <div class="filter-main">
        <el-button
          class="filter-expand"
          :type="model.expanded ? 'primary' : 'default'"
          :title="model.expanded ? '收起查询' : '展开查询'"
          @click="toggleExpanded"
        >
          <el-icon><Filter /></el-icon>
          <span class="expand-text">{{ model.expanded ? '收起' : '展开' }}</span>
          <el-icon class="expand-arrow" :class="{ 'is-expanded': model.expanded }"><ArrowDown /></el-icon>
        </el-button>
        <div class="filter-date">
          <el-date-picker
            v-model="model.dateRange"
            type="daterange"
            unlink-panels
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            @change="onDateRangeChange"
            @visible-change="onPanelVisibleChange"
            @panel-change="onPanelChange"
          >
            <template #default="{ text, date, renderText }">
              <div class="el-date-table-cell">
                <span class="el-date-table-cell__text">{{ renderText ?? text }}</span>
                <span v-if="!renderText && date && hasTaskOnDate(date)" class="date-cell-dot"></span>
              </div>
            </template>
          </el-date-picker>
        </div>
        <!-- 回车与点击搜索按钮等价，主动触发查询 -->
        <el-input
          v-model="model.keyword"
          class="filter-keyword"
          placeholder="搜索关键字..."
          clearable
          @keyup.enter="emitSearch"
        />
      </div>
      <div class="filter-actions">
        <el-select v-model="model.searchScope" class="filter-scope" title="仅影响关键字搜索">
          <el-option label="全部历史" value="all" />
          <el-option label="当前范围" value="range" />
        </el-select>
        <el-dropdown class="filter-quick" @command="quickRange">
          <el-button>
            {{ activeQuickLabel }}<el-icon style="margin-left: 2px"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="all">全部</el-dropdown-item>
              <el-dropdown-item divided command="yesterday">昨天</el-dropdown-item>
              <el-dropdown-item command="lastWeek">上周</el-dropdown-item>
              <el-dropdown-item command="lastMonth">上月</el-dropdown-item>
              <el-dropdown-item divided command="today">今天</el-dropdown-item>
              <el-dropdown-item command="week">本周</el-dropdown-item>
              <el-dropdown-item command="month">本月</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <!-- 条件变更不自动查询，点击搜索才取数 -->
        <el-button class="filter-search" type="primary" :icon="Search" :loading="searching" @click="emitSearch">
          搜索
        </el-button>
        <el-button text :disabled="searching" @click="resetFilters">重置</el-button>
      </div>
    </div>

    <!-- 展开区：精细筛选，每类一行，超出 24 栅格自动换行 -->
    <div v-if="model.expanded" class="filter-bar-advanced">
      <div class="filter-group">
        <span class="filter-label">状态</span>
        <el-row :gutter="12" class="filter-row">
          <el-col :span="4">
            <el-select v-model="model.filterSyncStatus" placeholder="同步状态" clearable>
              <el-option label="未同步" value="none" />
              <el-option label="已同步" value="synced" />
            </el-select>
          </el-col>
          <el-col :span="4">
            <el-select v-model="model.filterStatus" placeholder="平台状态" clearable>
              <el-option v-for="v in platformStatusOptions" :key="v" :label="v" :value="v" />
            </el-select>
          </el-col>
          <el-col :span="4">
            <el-select v-model="model.filterValid" placeholder="校验" clearable>
              <el-option label="通过" value="pass" />
              <el-option label="异常" value="fail" />
              <el-option label="未检查" value="uncheck" />
            </el-select>
          </el-col>
        </el-row>
      </div>
      <div class="filter-group">
        <span class="filter-label">执行</span>
        <el-row :gutter="12" class="filter-row">
          <el-col :span="4">
            <el-select v-model="model.filterPriority" placeholder="执行优先级" clearable>
              <el-option label="高" value="high" />
              <el-option label="中" value="medium" />
              <el-option label="低" value="low" />
              <el-option label="无" value="none" />
            </el-select>
          </el-col>
          <el-col :span="4">
            <el-select v-model="model.filterPostponed" placeholder="执行延期" clearable>
              <el-option label="是" value="true" />
              <el-option label="否" value="false" />
            </el-select>
          </el-col>
        </el-row>
      </div>
      <div class="filter-group">
        <span class="filter-label">平台</span>
        <el-row :gutter="12" class="filter-row">
          <el-col :span="4">
            <el-select v-model="model.filterEval" placeholder="平台评价" clearable>
              <el-option label="好" value="好" />
              <el-option label="合格" value="合格" />
              <el-option label="其他" value="其他" />
            </el-select>
          </el-col>
          <el-col :span="4">
            <el-select v-model="model.filterType" placeholder="平台类型" clearable>
              <el-option v-for="v in platformTypeOptions" :key="v" :label="v" :value="v" />
            </el-select>
          </el-col>
        </el-row>
      </div>
      <div class="filter-group">
        <span class="filter-label">时间</span>
        <el-row :gutter="12" class="filter-row">
          <el-col :span="6">
            <el-date-picker
              v-model="model.filterAddedDate"
              type="daterange"
              unlink-panels
              value-format="YYYY-MM-DD"
              range-separator="至"
              start-placeholder="起点"
              end-placeholder="终点"
              @change="onAddedDateChange"
            />
          </el-col>
        </el-row>
      </div>
      <div class="filter-group">
        <span class="filter-label">文本</span>
        <el-row :gutter="12" class="filter-row">
          <el-col :span="4">
            <el-select
              v-model="model.filterProjects"
              placeholder="文本项目"
              multiple
              collapse-tags
              collapse-tags-tooltip
              clearable
              filterable
            >
              <el-option v-for="v in projectOptions" :key="v" :label="v" :value="v" />
            </el-select>
          </el-col>
          <el-col :span="4">
            <el-input v-model="model.filterUrl" placeholder="链接包含..." clearable />
          </el-col>
          <el-col :span="4">
            <el-input v-model="model.filterTitle" placeholder="文本标题包含..." clearable />
          </el-col>
        </el-row>
      </div>
      <div class="filter-group">
        <span class="filter-label">人员</span>
        <el-row :gutter="12" class="filter-row">
          <el-col :span="4">
            <el-select
              v-model="model.filterHandlers"
              placeholder="处理人"
              multiple
              collapse-tags
              collapse-tags-tooltip
              clearable
              filterable
            >
              <el-option v-for="v in handlerOptions" :key="v" :label="v" :value="v" />
            </el-select>
          </el-col>
        </el-row>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export interface FilterState {
  dateRange: [Date, Date]
  keyword: string
  searchScope: 'range' | 'all'
  filterPriority: string
  filterPostponed: string
  filterSyncStatus: string
  filterStatus: string
  filterType: string
  filterValid: string
  filterEval: string
  expanded: boolean
  filterAddedDate: string[]
  filterProjects: string[]
  filterHandlers: string[]
  filterTitle: string
  filterUrl: string
}

export function createDefaultFilterState(): FilterState {
  const today = new Date()
  return {
    dateRange: [today, today],
    keyword: '',
    // 有关键字时默认查全部历史，需要只查当前范围时手动切换
    searchScope: 'all',
    filterPriority: '',
    filterPostponed: '',
    filterSyncStatus: '',
    filterStatus: '',
    filterType: '',
    filterValid: '',
    filterEval: '',
    expanded: false,
    filterAddedDate: [],
    filterProjects: [],
    filterHandlers: [],
    filterTitle: '',
    filterUrl: '',
  }
}
</script>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowDown, Filter, Search } from '@element-plus/icons-vue'
import { addDays, formatYMD } from '@/utils/date'
import { ipc } from '@/utils/ipc'
import type { HistoryTaskItem } from '@/types/ipc'

const model = defineModel<FilterState>({ required: true })
const props = defineProps<{ tasks: HistoryTaskItem[]; searching?: boolean }>()
const emit = defineEmits<{
  (e: 'search'): void
  (e: 'restored'): void
}>()

const FILTER_BAR_STORAGE_KEY = 'historyFilterBar'

// 需要持久化的筛选字段，关键字与日期范围属于查询动作，切换页面时重置
const PERSISTED_KEYS = [
  'filterPriority',
  'filterPostponed',
  'filterSyncStatus',
  'filterStatus',
  'filterType',
  'filterValid',
  'filterEval',
  'filterAddedDate',
  'filterProjects',
  'filterHandlers',
  'filterTitle',
  'filterUrl',
] as const

// 回显完成前不落盘，避免加载时的默认值覆盖上次记录
let filterRestored = false
const activeQuickLabel = ref('快捷范围')

const persistedState = computed(() => {
  const state: Record<string, unknown> = { expanded: model.value.expanded }
  for (const key of PERSISTED_KEYS) state[key] = model.value[key]
  return state
})

/**
 * 读取上次保存的筛选条件与展开状态并回显，保证列表与筛选栏一致
 */
async function restoreFilterState() {
  const saved = await ipc.storeGet(FILTER_BAR_STORAGE_KEY)
  if (saved && typeof saved === 'object') {
    model.value.expanded = !!saved.expanded
    const state = model.value as unknown as Record<string, unknown>
    for (const key of PERSISTED_KEYS) {
      const value = saved[key]
      // 仅回显类型一致的字段，避免历史数据格式变更后污染状态
      if (value !== undefined && typeof value === typeof state[key]) state[key] = value
    }
  }
  filterRestored = true
  emit('restored')
}

/**
 * 保存当前筛选条件与展开状态，下次进入页面时自动回显
 */
function persistFilterState() {
  if (!filterRestored) return
  // model 为响应式对象，ipc 会净化为普通对象再写盘
  ipc.storeSet(FILTER_BAR_STORAGE_KEY, persistedState.value)
}

watch(persistedState, persistFilterState, { deep: true })

onMounted(restoreFilterState)

function toggleExpanded() {
  model.value.expanded = !model.value.expanded
}

function emitSearch() {
  emit('search')
}

/**
 * 手动选择日期范围后清掉快捷范围标签，条件本身等待点击搜索后生效
 */
function onDateRangeChange() {
  activeQuickLabel.value = '快捷范围'
}

/**
 * 添加日期筛选变化，选择器清空时值为 null，统一归一化为空数组
 */
function onAddedDateChange() {
  if (!model.value.filterAddedDate) model.value.filterAddedDate = []
}

/**
 * 生成去重升序的非空选项
 * @param {(string | undefined)[]} values 原始值列表
 * @returns {string[]} 去重排序后的非空选项
 */
function uniqueSorted(values: (string | undefined)[]): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort()
}

const projectOptions = computed(() => uniqueSorted(props.tasks.map((t) => t.rawProjectName)))
const handlerOptions = computed(() => uniqueSorted(props.tasks.map((t) => t.rawHandler)))
const platformStatusOptions = computed(() => uniqueSorted(props.tasks.map((t) => t.remote?._embedded?.status?.name)))
const platformTypeOptions = computed(() => uniqueSorted(props.tasks.map((t) => t.remote?._embedded?.type?.name)))

// 面板可见月份内存在任务的日期
const dotDates = ref<string[]>([])
const taskDateSet = computed(() => new Set(dotDates.value))
// 上一次圆点查询的月份组合，面板打开期间月份不变时不重复查询
let dotRangeKey = ''

/**
 * 取日期所在月份键（YYYY-MM）
 * @param {Date} date 日期
 * @returns {string} 月份键
 */
function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 查询可见月份内有任务的日期；月份可能不相邻，逐月查询
 * @param {Date[]} months 面板日期
 */
async function loadDotDates(months: Date[]) {
  const keys = Array.from(new Set(months.map(monthKey))).sort()
  const key = keys.join(',')
  if (key === dotRangeKey) return
  dotRangeKey = key
  const groups = await Promise.all(
    keys.map((month) => {
      const [year, monthNumber] = month.split('-').map(Number)
      return ipc.listHistoryDates({
        startDate: formatYMD(new Date(year, monthNumber - 1, 1)),
        endDate: formatYMD(new Date(year, monthNumber, 0)),
      })
    }),
  )
  // 请求期间用户已翻到别的月份时丢弃过期结果
  if (key !== dotRangeKey) return
  dotDates.value = Array.from(new Set(groups.flat()))
}

/**
 * 面板打开时按当前起止月份加载圆点，关闭时清空月份键，下次打开重新查询
 * @param {boolean} visible 面板是否可见
 */
function onPanelVisibleChange(visible: boolean) {
  if (!visible) {
    dotRangeKey = ''
    return
  }
  const [start, end] = model.value.dateRange || []
  const left = start ? new Date(start) : new Date()
  const right = end ? new Date(end) : new Date()
  // 归到月初再翻月，避免 31 号在短月份溢出到再下一个月
  right.setDate(1)
  // 起止同月时右面板展示下一个月（日期面板默认行为）
  if (monthKey(left) === monthKey(right)) right.setMonth(right.getMonth() + 1)
  loadDotDates([left, right])
}

/**
 * 面板翻月后按新的可见月份查询圆点，daterange 回传左右面板日期
 * @param {Date[]} dates 左右面板当前日期
 */
function onPanelChange(dates: Date[]) {
  if (!Array.isArray(dates) || dates.length < 2) return
  loadDotDates(dates)
}

function hasTaskOnDate(date: Date): boolean {
  return taskDateSet.value.has(formatYMD(date))
}

/**
 * 重置全部筛选条件并立即按默认条件搜索，展开状态属界面状态不参与重置
 */
function resetFilters() {
  const defaults = createDefaultFilterState()
  const state = model.value as unknown as Record<string, unknown>
  const initial = defaults as unknown as Record<string, unknown>
  for (const key of PERSISTED_KEYS) state[key] = initial[key]
  model.value.keyword = defaults.keyword
  model.value.searchScope = defaults.searchScope
  model.value.dateRange = defaults.dateRange
  activeQuickLabel.value = '快捷范围'
  emit('search')
}

/**
 * 按快捷范围设置日期条件，设置后等待点击搜索才取数
 * @param {string} type 快捷范围类型
 */
async function quickRange(type: string) {
  const labelMap: Record<string, string> = {
    yesterday: '昨天',
    lastWeek: '上周',
    lastMonth: '上月',
    today: '今天',
    week: '本周',
    month: '本月',
    all: '全部',
  }
  activeQuickLabel.value = labelMap[type] || '快捷范围'
  const today = new Date()
  if (type === 'yesterday') {
    const y = addDays(today, -1)
    model.value.dateRange = [y, y]
  } else if (type === 'lastWeek') {
    // 上一自然周（周一至周日）：先求本周周一，再整体前移一周
    const day = today.getDay()
    const thisMonday = new Date(today)
    thisMonday.setDate(thisMonday.getDate() - ((day + 6) % 7))
    model.value.dateRange = [addDays(thisMonday, -7), addDays(thisMonday, -1)]
  } else if (type === 'lastMonth') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const end = new Date(today.getFullYear(), today.getMonth(), 0)
    model.value.dateRange = [start, end]
  } else if (type === 'today') {
    model.value.dateRange = [today, today]
  } else if (type === 'week') {
    const day = today.getDay()
    const mon = new Date(today)
    mon.setDate(mon.getDate() - ((day + 6) % 7))
    const sun = new Date(mon)
    sun.setDate(sun.getDate() + 6)
    model.value.dateRange = [mon, sun]
  } else if (type === 'month') {
    model.value.dateRange = [
      new Date(today.getFullYear(), today.getMonth(), 1),
      new Date(today.getFullYear(), today.getMonth() + 1, 0),
    ]
  } else if (type === 'all') {
    // 起点取历史记录的最早日期，避免硬编码上限遗漏早期记录；无历史时从今天起
    const dates = await ipc.listHistoryDates()
    const earliest = dates.length ? new Date(dates[dates.length - 1]) : today
    model.value.dateRange = [earliest, today]
  }
}
</script>

<style scoped>
.filter-bar-wrap {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--app-space-2);
  background: var(--el-bg-color-overlay);
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: thin;
}
.filter-main,
.filter-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.filter-main {
  flex: 1 1 auto;
}
.filter-actions {
  flex: 0 0 auto;
}
/* 按钮与下拉不压缩，其余控件按可用宽度收缩 */
.filter-main > .el-button,
.filter-actions > .el-button,
.filter-actions > .el-dropdown {
  flex-shrink: 0;
}
.filter-date {
  flex: 0 1 310px;
  min-width: 300px;
}
.filter-date :deep(.el-date-editor) {
  width: 100%;
}
.filter-keyword {
  flex: 1 1 260px;
  min-width: 180px;
}
.filter-scope {
  flex: 0 1 120px;
  min-width: 112px;
}
.filter-quick {
  flex: 0 0 auto;
}
.filter-quick :deep(.el-button) {
  width: 90px;
}
.filter-bar-advanced {
  padding: var(--app-space-2);
  background: var(--el-fill-color-lighter);
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
}
/* 标签在栅格之外，与所在行的栅格横向对齐 */
.filter-group {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
}
.filter-group + .filter-group {
  margin-top: var(--app-space-1);
}
.filter-row {
  flex: 1;
  min-width: 0;
  align-items: center;
}
.filter-label {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
  font-size: var(--el-font-size-small);
}
/* 栅格单元内的控件撑满整列 */
.filter-bar-advanced :deep(.el-select),
.filter-bar-advanced :deep(.el-input),
.filter-bar-advanced :deep(.el-date-editor) {
  width: 100%;
}
.expand-text {
  margin: 0 2px;
}
.expand-arrow {
  transition: transform 0.2s;
}
.expand-arrow.is-expanded {
  transform: rotate(180deg);
}
.date-cell-dot {
  position: absolute;
  bottom: 2px;
  left: 50%;
  width: 4px;
  height: 4px;
  margin-left: -2px;
  border-radius: 50%;
  background: var(--el-color-primary);
}
</style>
