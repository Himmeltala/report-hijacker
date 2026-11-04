<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-28 01:12:08
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-28 12:14:04
 * @FilePath: /src/views/HistoryTask/components/HeatmapStats.vue
 * @Description: 热力图统计组件，按所选时段展示每日任务数量分布
-->
<template>
  <div class="heatmap-stats">
    <span v-if="heatmapTotal && !loading" class="heatmap-summary">共 {{ heatmapTotal }} 个任务</span>
    <el-skeleton v-if="loading" animated class="heatmap-skeleton">
      <template #template>
        <el-skeleton-item variant="rect" style="width: 100%; height: 100%; border-radius: 8px" />
      </template>
    </el-skeleton>
    <el-empty v-else-if="!heatmapTotal" description="该时段暂无任务" />
    <div v-else ref="chartRef" class="heatmap-chart-body"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useChartRoll, isDarkTheme, getThemeTextColors } from '@/composables/useEcharts'
import { getGlassTooltipStyle, tooltipRow } from '@/utils/color'
import { useLogStore } from '@/stores/log.store'
import { ipc } from '@/utils/ipc'

const logStore = useLogStore()

interface StatsRange {
  start: string
  end: string
  calendar: number | string
}

// 深浅主题均采用「低亮高深」的蓝色序列，任务数越多颜色越深
const HEATMAP_COLORS_LIGHT = ['#cde2fb', '#86b6ef', '#3987e5', '#256abf', '#184f95', '#0d366b']
const HEATMAP_COLORS_DARK = ['#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#104281']

/**
 * 获取当前主题下的热力图配色序列
 * @returns 按热度由低到高的颜色数组
 */
function getHeatmapColors(): string[] {
  return isDarkTheme() ? HEATMAP_COLORS_DARK : HEATMAP_COLORS_LIGHT
}

/**
 * 获取抽屉表面颜色，用作热力格间隙颜色
 * @returns 表面颜色值，取不到 CSS 变量时返回主题对应的兜底色
 */
function getCellGapColor(): string {
  const surface = getComputedStyle(document.documentElement).getPropertyValue('--el-bg-color-overlay').trim()
  return surface || (isDarkTheme() ? '#1d1e1f' : '#ffffff')
}

const props = defineProps<{ range: StatsRange }>()
const loading = ref(false)
const heatmapData = ref<Array<[string, number]>>([])
const chartRef = ref<HTMLDivElement | null>(null)

const heatmapTotal = computed(() => heatmapData.value.reduce((sum, item) => sum + item[1], 0))

/**
 * 拉取选中时段的历史数据并聚合为每日任务数量
 */
async function loadHeatmap() {
  loading.value = true
  try {
    const days = await ipc.queryHistory({
      startDate: props.range.start,
      endDate: props.range.end,
    })
    heatmapData.value = days.map((day) => [day.date, day.tasks.length] as [string, number])
  } catch (e: any) {
    logStore.addLog('error', '热力图数据加载失败: ' + (e?.message || e))
    heatmapData.value = []
  } finally {
    loading.value = false
  }
}

watch(() => props.range, loadHeatmap, { immediate: true })

useChartRoll({
  chartRef,
  dataSource: heatmapData,
  xAxis: () => [],
  generateOption: (data: any, chart: any) => {
    if (!data || !data.length) return {}
    const counts = data.map((item: any) => item[1])
    const maxCount = Math.max(...counts, 1)
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
          const color = params.color?.colorStops ? params.color.colorStops[0]?.color : params.color
          return `<div style="margin-bottom:4px;font-weight:600;">${params.value[0]}</div>${tooltipRow(color, `任务数: ${params.value[1]}`)}`
        },
        appendToBody: true,
      },
      visualMap: {
        show: false,
        min: 0,
        max: maxCount,
        inRange: { color: getHeatmapColors() },
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
          data,
          animationDurationUpdate: 600,
          animationEasingUpdate: 'cubicInOut',
        },
      ],
    }
  },
  maxLength: -1,
})
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
.heatmap-skeleton {
  flex: 1;
  min-height: 0;
}
.heatmap-chart-body {
  width: 100%;
  flex: 1;
  min-height: 0;
}
</style>
