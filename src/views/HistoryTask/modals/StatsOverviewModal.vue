<!--
 * @Author: Himmeltala
 * @Date: 2026-11-08 16:10:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-08 16:10:00
 * @FilePath: \src\views\HistoryTask\modals\StatsOverviewModal.vue
 * @Description: 数据统计弹窗，分页展示任务数热力图、每日达标时长热力图、矩阵树形与趋势，每页 3 个图表
-->
<template>
  <el-dialog
    :model-value="visible"
    title="数据统计"
    width="min(1100px, 94vw)"
    top="6vh"
    destroy-on-close
    @update:model-value="$emit('update:visible', $event)"
  >
    <div class="stats-overview-panel">
      <div class="stats-toolbar">
        <div class="stats-filter">
          <el-radio-group v-model="mode">
            <el-radio-button value="year">按年</el-radio-button>
            <el-radio-button value="month">按月</el-radio-button>
          </el-radio-group>
          <el-date-picker v-if="mode === 'year'" v-model="yearValue" type="year" :clearable="false" style="width: 110px" />
          <el-date-picker v-else v-model="monthValue" type="month" :clearable="false" style="width: 130px" />
        </div>
        <div class="stats-pager">
          <el-button circle size="small" :icon="ArrowLeft" :disabled="page === 0" @click="page--" />
          <span class="stats-pager-text">{{ page + 1 }} / {{ totalPages }}</span>
          <el-button circle size="small" :icon="ArrowRight" :disabled="page >= totalPages - 1" @click="page++" />
        </div>
      </div>
      <el-skeleton v-if="loading" animated class="stats-loading">
        <template #template>
          <el-skeleton-item v-for="i in 3" :key="i" variant="rect" class="stats-loading-item" />
        </template>
      </el-skeleton>
      <div v-else class="stats-pages">
        <template v-if="page === 0">
          <HeatmapStats :range="range" :days="days" />
          <DailyHoursHeatmapStats :range="range" :days="days" />
          <TreemapStats :range="range" :days="days" />
        </template>
        <template v-else>
          <TrendStats :range="range" :days="days" />
        </template>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { useLogStore } from '@/stores/log.store'
import { ipc } from '@/utils/ipc'
import { getErrorMessage } from '@/utils/error'
import type { HistoryDay } from '@/types/ipc'
import HeatmapStats from '@/views/HistoryTask/components/HeatmapStats.vue'
import DailyHoursHeatmapStats from '@/views/HistoryTask/components/DailyHoursHeatmapStats.vue'
import TreemapStats from '@/views/HistoryTask/components/TreemapStats.vue'
import TrendStats from '@/views/HistoryTask/components/TrendStats.vue'

const logStore = useLogStore()

defineProps<{
  visible: boolean
}>()

defineEmits<{
  close: []
  'update:visible': [value: boolean]
}>()

// 每页展示的图表数量
const PAGE_SIZE = 3
const TOTAL_CHARTS = 4

type StatsMode = 'year' | 'month'

const mode = ref<StatsMode>('year')
const yearValue = ref(new Date())
const monthValue = ref(new Date())
const page = ref(0)
const totalPages = Math.ceil(TOTAL_CHARTS / PAGE_SIZE)

// 四个图表共用同一份历史数据，避免每个图表各查一次
const days = ref<HistoryDay[]>([])
const loading = ref(false)
// 查询序号，区间快速切换时丢弃过期结果
let querySeq = 0

async function loadDays() {
  const seq = ++querySeq
  loading.value = true
  try {
    const result = await ipc.queryHistory({
      startDate: range.value.start,
      endDate: range.value.end,
    })
    if (seq !== querySeq) return
    days.value = result
  } catch (e) {
    if (seq !== querySeq) return
    logStore.addLog('error', '数据统计数据加载失败: ' + getErrorMessage(e, String(e)))
    days.value = []
  } finally {
    if (seq === querySeq) loading.value = false
  }
}

/**
 * 根据当前模式生成查询区间与日历范围
 * @returns 查询起始日期、结束日期及日历展示范围
 */
const range = computed<{ start: string; end: string; calendar: number | string }>(() => {
  if (mode.value === 'year') {
    const year = yearValue.value.getFullYear()
    return { start: `${year}-01-01`, end: `${year}-12-31`, calendar: year }
  }
  const year = monthValue.value.getFullYear()
  const month = monthValue.value.getMonth() + 1
  const monthText = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  return {
    start: `${year}-${monthText}-01`,
    end: `${year}-${monthText}-${String(lastDay).padStart(2, '0')}`,
    calendar: `${year}-${monthText}`,
  }
})

watch(range, loadDays, { immediate: true })
</script>

<style scoped>
.stats-overview-panel {
  display: flex;
  flex-direction: column;
  height: min(74vh, 720px);
  gap: var(--app-space-2);
}
.stats-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-3);
  flex-shrink: 0;
}
.stats-filter {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}
.stats-pager {
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
}
.stats-pager-text {
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
  min-width: 34px;
  text-align: center;
}
.stats-loading {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: var(--app-space-2);
}
.stats-loading-item {
  flex: 1;
  width: 100%;
  border-radius: 8px;
}
.stats-pages {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: var(--app-space-2);
}
.stats-pages > * {
  flex: 1;
  min-height: 0;
}
</style>
