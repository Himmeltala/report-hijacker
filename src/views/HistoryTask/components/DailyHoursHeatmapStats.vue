<!--
 * @Author: Himmeltala
 * @Date: 2026-11-06 20:59:51
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-06 20:59:51
 * @FilePath: \src\views\HistoryTask\components\DailyHoursHeatmapStats.vue
 * @Description: 每日达标时长热力图组件，按所选时段展示每日平台自评时长是否达到 7.5 小时
-->
<template>
  <div class="daily-hours-stats">
    <span v-if="dataDays && !loading" class="daily-hours-summary">
      每日目标 7.5h，达标 <strong class="hours-pass">{{ passedDays }}</strong> 天，未达标
      <strong class="hours-fail">{{ dataDays - passedDays }}</strong> 天
    </span>
    <el-skeleton v-if="loading" animated class="daily-hours-skeleton">
      <template #template>
        <el-skeleton-item variant="rect" style="width: 100%; height: 100%; border-radius: 8px" />
      </template>
    </el-skeleton>
    <el-empty v-else-if="!dataDays" description="该时段暂无任务" />
    <div v-else ref="chartRef" class="daily-hours-chart-body"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useChartRoll, isDarkTheme, getThemeTextColors } from '@/composables/useEcharts'
import { getGlassTooltipStyle, tooltipRow } from '@/utils/color'
import { convertIso8601ToHours } from '@/utils/parser'
import { useLogStore } from '@/stores/log.store'
import { ipc } from '@/utils/ipc'

const logStore = useLogStore()

interface StatsRange {
  start: string
  end: string
  calendar: number | string
}

interface DailyHoursItem {
  value: [string, number]
  itemStyle: { color: string }
}

// 每日达标目标小时数，达到记绿、不足记红
const DAILY_TARGET_HOURS = 7.5
const PASS_COLOR = '#67c23a'
const FAIL_COLOR = '#f56c6c'

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
const dailyHours = ref<DailyHoursItem[]>([])
const chartRef = ref<HTMLDivElement | null>(null)

const dataDays = computed(() => dailyHours.value.length)
const passedDays = computed(() => dailyHours.value.filter((item) => item.value[1] >= DAILY_TARGET_HOURS).length)

/**
 * 拉取选中时段的历史数据，按日汇总平台自评时长并判定是否达标
 */
async function loadDailyHours() {
  loading.value = true
  try {
    const days = await ipc.queryHistory({
      startDate: props.range.start,
      endDate: props.range.end,
    })
    dailyHours.value = days
      .filter((day) => day.tasks.length > 0)
      .map((day) => {
        const hours =
          Math.round(
            day.tasks.reduce((sum, task) => sum + convertIso8601ToHours(task.remote?.estimatedTime || ''), 0) * 100,
          ) / 100
        return {
          value: [day.date, hours] as [string, number],
          itemStyle: { color: hours >= DAILY_TARGET_HOURS ? PASS_COLOR : FAIL_COLOR },
        }
      })
  } catch (e: any) {
    logStore.addLog('error', '达标时长热力图数据加载失败: ' + (e?.message || e))
    dailyHours.value = []
  } finally {
    loading.value = false
  }
}

watch(() => props.range, loadDailyHours, { immediate: true })

useChartRoll({
  chartRef,
  dataSource: dailyHours,
  xAxis: () => [],
  generateOption: (data: any) => {
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
          const color = passed ? PASS_COLOR : FAIL_COLOR
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
</script>

<style scoped>
.daily-hours-stats {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: var(--app-space-2);
}
.daily-hours-summary {
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}
.daily-hours-summary .hours-pass {
  color: var(--el-color-success);
}
.daily-hours-summary .hours-fail {
  color: var(--el-color-danger);
}
.daily-hours-skeleton {
  flex: 1;
  min-height: 0;
}
.daily-hours-chart-body {
  width: 100%;
  flex: 1;
  min-height: 0;
}
</style>
