<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14 01:35:00
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-28 01:35:00
 * @FilePath: \src\views\HistoryTask\components\CompareWithLastDrawer.vue
 * @Description: 与上期对比抽屉组件，展示统计柱状图与各项对比明细
-->
<template>
  <div class="stats-detail">
    <div ref="chartRef" class="stats-chart"></div>
    <div class="stats-compare">
      <div class="cmp-row" v-for="r in detailRows" :key="r.label">
        <span class="cmp-label">{{ r.label }}</span>
        <span class="cmp-val"
          >上期 <strong>{{ r.prev }}</strong></span
        >
        <span class="cmp-val"
          >本期 <strong>{{ r.curr }}</strong></span
        >
        <span v-if="r.growth !== null" class="cmp-growth" :class="r.growth >= 0 ? 'up' : 'down'">
          {{ r.growth >= 0 ? '+' : '' }}{{ r.growth }}%
        </span>
        <span v-else class="cmp-growth text-muted">-</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChartRoll, getThemeTextColors, isDarkTheme } from '@/composables/useEcharts'
import { getGlassTooltipStyle, tooltipRow } from '@/utils/color'
import type { CompareChartItem, CompareDetailRow } from '@/types/chart'

const props = withDefaults(
  defineProps<{
    chartData: CompareChartItem[]
    detailRows: CompareDetailRow[]
  }>(),
  { chartData: () => [], detailRows: () => [] },
)

const chartRef = ref<HTMLDivElement | null>(null)
const safeData = computed(() => props.chartData || [])

useChartRoll({
  chartRef,
  dataSource: safeData,
  xAxis: (data: CompareChartItem[]) => (data || []).map((d) => d.label),
  generateOption: (data: CompareChartItem[]) => {
    if (!data || !data.length) return {}
    const colors = getThemeTextColors()
    return {
      backgroundColor: 'transparent',
      legend: { show: false },
      tooltip: {
        ...getGlassTooltipStyle(isDarkTheme()),
        trigger: 'axis',
        appendToBody: true,
        formatter: (params: any) => {
          const lines = params.map((item: any) => {
            const color = item.color?.colorStops ? item.color.colorStops[0]?.color : item.color
            return tooltipRow(color, `${item.seriesName}: ${item.value ?? 0}`)
          })
          return `<div style="margin-bottom:4px;font-weight:600;">${params[0]?.axisValue ?? ''}</div>${lines.join('')}`
        },
      },
      grid: { left: 50, right: 20, top: 24, bottom: 24 },
      xAxis: {
        type: 'category',
        axisLabel: { color: colors.secondary },
        axisLine: { lineStyle: { color: colors.secondary } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        axisLabel: { color: colors.secondary },
        splitLine: { lineStyle: { color: colors.secondary, opacity: 0.3 } },
      },
      series: [
        {
          name: '上期',
          type: 'bar',
          barWidth: '28%',
          itemStyle: { color: '#909399' },
          data: data.map((d: any) => d.prev),
        },
        {
          name: '本期',
          type: 'bar',
          barWidth: '28%',
          itemStyle: { color: '#409eff' },
          data: data.map((d: any) => d.curr),
        },
      ],
    }
  },
  maxLength: -1,
})
</script>

<style scoped>
.stats-detail {
  padding: 0 var(--app-space-2);
}
.stats-chart {
  width: 100%;
  height: 260px;
}
.stats-compare {
  margin-top: var(--app-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--app-space-2);
}
.cmp-row {
  display: grid;
  grid-template-columns: 110px 1fr 1fr 80px;
  align-items: center;
  gap: var(--app-space-3);
  padding: var(--app-space-2) var(--app-space-3);
  background: var(--el-fill-color-light);
  border-radius: var(--app-radius-sm);
  font-size: var(--el-font-size-small);
}
.cmp-label {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cmp-val strong {
  color: var(--el-color-primary);
  margin: 0 2px;
}
.cmp-growth {
  text-align: right;
  font-weight: 600;
}
.up {
  color: var(--el-color-success);
}
.down {
  color: var(--el-color-danger);
}
</style>
