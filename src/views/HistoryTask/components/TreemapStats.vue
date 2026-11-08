<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-28 01:12:17
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-08 17:56:00
 * @FilePath: /src/views/HistoryTask/components/TreemapStats.vue
 * @Description: 矩阵树形统计组件，按所选时段展示各文本项目的任务数量占比
-->
<template>
  <div class="treemap-stats">
    <el-empty v-if="!treemapData.length" description="该时段暂无任务" />
    <ChartExportFrame v-else @export="exportChart">
      <div ref="treemapRef" class="treemap-stats-body"></div>
    </ChartExportFrame>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ChartExportFrame from '@/components/ChartExportFrame.vue'
import { useChartRoll, isDarkTheme, getThemeTextColors } from '@/composables/useEcharts'
import { getGlassTooltipStyle, tooltipRow } from '@/utils/color'
import type { HistoryDay } from '@/types/ipc'
import type { ProjectShareItem, StatsRange } from '@/types/chart'

// 项目占比图配色，覆盖不同数量的项目块以保证区分度
const TREEMAP_COLORS = [
  '#409eff',
  '#67c23a',
  '#e6a23c',
  '#f56c6c',
  '#8a5cf6',
  '#00b4d8',
  '#d6408a',
  '#909399',
  '#19be6b',
  '#f39c12',
  '#2db7f5',
]

const props = defineProps<{ range: StatsRange; days: HistoryDay[] }>()
const treemapRef = ref<HTMLDivElement | null>(null)

// 由父组件统一下发历史数据，这里聚合各文本项目的任务数量
const treemapData = computed<ProjectShareItem[]>(() => {
  const countMap = new Map<string, number>()
  for (const day of props.days || []) {
    for (const t of day.tasks) {
      const key = t.rawProjectName || '未命名项目'
      countMap.set(key, (countMap.get(key) || 0) + 1)
    }
  }
  return Array.from(countMap, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
})

const { getDataURL } = useChartRoll({
  chartRef: treemapRef,
  dataSource: treemapData,
  xAxis: () => [],
  generateOption: (data: ProjectShareItem[]) => {
    if (!data || !data.length) return {}
    const colors = getThemeTextColors()
    const surface =
      getComputedStyle(document.documentElement).getPropertyValue('--el-bg-color-overlay').trim() ||
      (isDarkTheme() ? '#1d1e1f' : '#ffffff')
    return {
      backgroundColor: 'transparent',
      color: TREEMAP_COLORS,
      tooltip: {
        ...getGlassTooltipStyle(isDarkTheme()),
        formatter: (params: any) => {
          if (params.name === '其他') return ''
          const color = params.color?.colorStops ? params.color.colorStops[0]?.color : params.color
          return `<div style="margin-bottom:4px;font-weight:600;">${params.name}</div>${tooltipRow(color, `任务数: ${params.value} 个`)}`
        },
        appendToBody: true,
      },
      legend: {
        show: false,
        type: 'scroll',
        top: 0,
        data: data.map((d: any) => d.name),
        textStyle: { color: colors.secondary, fontSize: 11 },
        pageTextStyle: { color: colors.secondary },
        pageIconColor: colors.secondary,
        pageIconInactiveColor: colors.secondary,
      },
      grid: { left: 5, right: 5, top: 5, bottom: 5 },
      series: [
        {
          type: 'treemap',
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          label: {
            show: true,
            formatter: (params: any) => `${params.name} (${params.value})`,
            color: colors.primary,
          },
          itemStyle: {
            borderWidth: 1,
            borderColor: surface,
          },
          visibleMin: 300,
          data,
        },
      ],
    }
  },
  maxLength: -1,
})
// 导出当前图表为 PNG，文件名带上统计区间，便于区分不同时段
function exportChart(): void {
  getDataURL({ title: `项目任务分布-${props.range.calendar}` })
}
</script>

<style scoped>
.treemap-stats {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.treemap-stats-body {
  width: 100%;
  flex: 1;
  min-height: 0;
}
</style>
