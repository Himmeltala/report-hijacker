<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-28 01:12:08
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-08 17:56:00
 * @FilePath: /src/views/HistoryTask/components/HeatmapStats.vue
 * @Description: 任务数热力图组件，按所选时段展示每日任务数量分布，沿用蓝色档位配色，任务越多颜色越深
-->
<template>
  <div class="heatmap-stats">
    <span v-if="heatmapTotal" class="heatmap-summary">共 {{ heatmapTotal }} 个任务</span>
    <el-empty v-if="!heatmapTotal" description="该时段暂无任务" />
    <ChartExportFrame v-else @export="exportChart">
      <div ref="chartRef" class="heatmap-chart-body"></div>
    </ChartExportFrame>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ChartExportFrame from '@/components/ChartExportFrame.vue'
import { useChartRoll, isDarkTheme, getThemeTextColors } from '@/composables/useEcharts'
import { getGlassTooltipStyle, getHeatmapStageColor, tooltipRow } from '@/utils/color'
import type { HistoryDay } from '@/types/ipc'
import type { StatsRange } from '@/types/chart'

// 中间档对应的任务数，每 1 个任务一档：少于 2 个任务颜色变浅、多于 2 个任务颜色加深
const MIDDLE_STAGE_TASKS = 2

/**
 * 按当日任务数取热力格颜色，沿用每日时长热力图的蓝色档位配色
 * @param {number} count 当日任务数
 */
function getTaskColor(count: number): string {
  return getHeatmapStageColor(count - MIDDLE_STAGE_TASKS, isDarkTheme())
}

/**
 * 获取抽屉表面颜色，用作热力格间隙颜色
 * @returns 表面颜色值，取不到 CSS 变量时返回主题对应的兜底色
 */
function getCellGapColor(): string {
  const surface = getComputedStyle(document.documentElement).getPropertyValue('--el-bg-color-overlay').trim()
  return surface || (isDarkTheme() ? '#1d1e1f' : '#ffffff')
}

const props = defineProps<{ range: StatsRange; days: HistoryDay[] }>()
const chartRef = ref<HTMLDivElement | null>(null)

// 由父组件统一下发历史数据，这里只做按日聚合
const heatmapData = computed<Array<[string, number]>>(() =>
  (props.days || []).map((day) => [day.date, day.tasks.length] as [string, number]),
)

const heatmapTotal = computed(() => heatmapData.value.reduce((sum, item) => sum + item[1], 0))

const { getDataURL } = useChartRoll({
  chartRef,
  dataSource: heatmapData,
  xAxis: () => [],
  generateOption: (data: Array<[string, number]>, chart) => {
    if (!data || !data.length) return {}
    const isYear = typeof props.range.calendar === 'number'
    const colors = getThemeTextColors()
    // 根据容器高度计算每格高度，保证热力图撑满容器
    const containerHeight = chartRef.value?.clientHeight || 249
    const topOffset = 55
    const bottomOffset = 10
    const availableHeight = containerHeight - topOffset - bottomOffset
    const rows = isYear ? 7 : 5
    const cellHeight = Math.floor(availableHeight / rows)
    return {
      backgroundColor: 'transparent',
      tooltip: {
        ...getGlassTooltipStyle(isDarkTheme()),
        formatter: (params: any) => {
          const count: number = params.value[1]
          return `<div style="margin-bottom:4px;font-weight:600;">${params.value[0]}</div>${tooltipRow(getTaskColor(count), `任务数: ${count}`)}`
        },
        appendToBody: true,
      },
      calendar: {
        top: topOffset,
        left: 30,
        right: 30,
        bottom: bottomOffset,
        cellSize: ['auto', cellHeight],
        range: props.range.calendar,
        itemStyle: { borderWidth: 0.5, borderColor: getCellGapColor() },
        dayLabel: { show: true, firstDay: 1, color: colors.secondary, nameMap: 'ZH' },
        monthLabel: { nameMap: 'ZH', color: colors.secondary },
        yearLabel: { show: false },
        splitLine: { show: true, lineStyle: { color: getCellGapColor() } },
      },
      series: [
        {
          type: 'heatmap',
          coordinateSystem: 'calendar',
          data: data.map(([date, count]) => ({ value: [date, count], itemStyle: { color: getTaskColor(count) } })),
          animationDurationUpdate: 600,
          animationEasingUpdate: 'cubicInOut',
        },
      ],
    }
  },
  maxLength: -1,
})
// 导出当前图表为 PNG，文件名带上统计区间，便于区分不同时段
function exportChart(): void {
  getDataURL({ title: `任务数热力图-${props.range.calendar}` })
}
</script>

<style scoped>
.heatmap-stats {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: var(--app-space-2);
}
.heatmap-summary {
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}
.heatmap-chart-body {
  width: 100%;
  flex: 1;
  min-height: 0;
}
</style>
