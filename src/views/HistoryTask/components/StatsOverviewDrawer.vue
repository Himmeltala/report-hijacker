<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-28 01:00:39
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-28 10:11:16
 * @FilePath: /src/views/HistoryTask/components/StatsOverviewDrawer.vue
 * @Description: 数据统计抽屉组件，组合热力图统计与矩阵树形统计两个子组件
-->
<template>
  <div class="stats-overview-drawer">
    <div class="stats-filter">
      <el-radio-group v-model="mode">
        <el-radio-button value="year">按年</el-radio-button>
        <el-radio-button value="month">按月</el-radio-button>
      </el-radio-group>
      <el-date-picker v-if="mode === 'year'" v-model="yearValue" type="year" :clearable="false" style="width: 110px" />
      <el-date-picker v-else v-model="monthValue" type="month" :clearable="false" style="width: 130px" />
    </div>
    <HeatmapStats :range="range" />
    <TreemapStats :range="range" />
    <TrendStats :range="range" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import HeatmapStats from '@/views/HistoryTask/components/HeatmapStats.vue'
import TreemapStats from '@/views/HistoryTask/components/TreemapStats.vue'
import TrendStats from '@/views/HistoryTask/components/TrendStats.vue'

type StatsMode = 'year' | 'month'

const mode = ref<StatsMode>('year')
const yearValue = ref(new Date())
const monthValue = ref(new Date())

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
</script>

<style scoped>
.stats-overview-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: var(--app-space-2);
}
.stats-filter {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  flex-shrink: 0;
}
</style>
