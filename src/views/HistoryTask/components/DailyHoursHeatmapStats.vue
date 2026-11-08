<!--
 * @Author: Himmeltala
 * @Date: 2026-11-06 20:59:51
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-08 17:56:00
 * @FilePath: \src\views\HistoryTask\components\DailyHoursHeatmapStats.vue
 * @Description: 每日达标时长热力图组件，按所选时段展示每日平台自评时长，沿用任务数热力图的蓝色系，7.5 小时以上按档位加深、以下按档位减淡
-->
<template>
  <div class="daily-hours-stats">
    <el-empty v-if="!dataDays" description="该时段暂无任务" />
    <ChartExportFrame v-else @export="exportChart">
      <div ref="chartRef" class="daily-hours-chart-body"></div>
    </ChartExportFrame>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ChartExportFrame from '@/components/ChartExportFrame.vue'
import { useChartRoll, isDarkTheme, getThemeTextColors } from '@/composables/useEcharts'
import { getGlassTooltipStyle, getHeatmapStageColor, tooltipRow } from '@/utils/color'
import { convertIso8601ToHours } from '@/utils/parser'
import type { HistoryDay } from '@/types/ipc'
import type { DailyHoursItem, StatsRange } from '@/types/chart'

// 每日达标目标小时数，颜色沿用任务数热力图的蓝色序列：达标后按档位加深、不足按档位减淡
const DAILY_TARGET_HOURS = 7.5
const HOURS_STEP = 0.5

/**
 * 计算某天时长相对目标小时数所在的档位
 * @param {number} hours 当日平台自评时长
 */
function getHoursLevel(hours: number): number {
  const offset = (hours - DAILY_TARGET_HOURS) / HOURS_STEP
  return hours >= DAILY_TARGET_HOURS ? Math.floor(offset) : Math.ceil(offset)
}

/**
 * 根据档位取热力格颜色：刚好达标取蓝色序列中间色，档位越高越深、越低越浅
 * @param {number} hours 当日平台自评时长
 */
function getHoursColor(hours: number): string {
  return getHeatmapStageColor(getHoursLevel(hours), isDarkTheme())
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

// 由父组件统一下发历史数据，这里按日汇总平台自评时长并判定是否达标
const dailyHours = computed<DailyHoursItem[]>(() =>
  (props.days || [])
    .filter((day) => day.tasks.length > 0)
    .map((day) => {
      const hours =
        Math.round(
          day.tasks.reduce((sum, task) => sum + convertIso8601ToHours(task.remote?.estimatedTime || ''), 0) * 100,
        ) / 100
      return {
        value: [day.date, hours] as [string, number],
        itemStyle: { color: getHoursColor(hours) },
      }
    }),
)

const dataDays = computed(() => dailyHours.value.length)

const { getDataURL } = useChartRoll({
  chartRef,
  dataSource: dailyHours,
  xAxis: () => [],
  generateOption: (data: DailyHoursItem[]) => {
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
          const hours: number = params.value[1]
          const passed = hours >= DAILY_TARGET_HOURS
          const color = getHoursColor(hours)
          return `<div style="margin-bottom:4px;font-weight:600;">${params.value[0]}</div>${tooltipRow(color, `当日时长: ${hours}h`)}${tooltipRow(color, `达标: ${passed ? '是' : '否'}（目标 ${DAILY_TARGET_HOURS}h）`)}`
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
          data,
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
  getDataURL({ title: `每日时长热力图-${props.range.calendar}` })
}
</script>

<style scoped>
.daily-hours-stats {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: var(--app-space-2);
}
.daily-hours-chart-body {
  width: 100%;
  flex: 1;
  min-height: 0;
}
</style>
