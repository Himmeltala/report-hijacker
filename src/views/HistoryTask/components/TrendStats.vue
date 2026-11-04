<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-28 23:53:26
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-29 00:54:54
 * @FilePath: /src/views/HistoryTask/components/TrendStats.vue
 * @Description: 趋势统计组件，按所选时段展示各文本项目任务数量的走势
-->
<template>
  <div class="trend-stats">
    <el-skeleton v-if="loading" animated class="trend-skeleton">
      <template #template>
        <el-skeleton-item variant="rect" style="width: 100%; height: 100%; border-radius: 8px" />
      </template>
    </el-skeleton>
    <div v-else ref="trendRef" class="trend-stats-body"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useChartRoll, getThemeTextColors, isDarkTheme } from '@/composables/useEcharts'
import { createAreaGradient, getGlassTooltipStyle, tooltipRow } from '@/utils/color'
import { useLogStore } from '@/stores/log.store'
import { ipc } from '@/utils/ipc'

const logStore = useLogStore()

interface StatsRange {
  start: string
  end: string
  calendar: number | string
}

interface TrendSeries {
  name: string
  values: number[]
}

interface TrendData {
  dates: string[]
  series: TrendSeries[]
}

// 趋势图最多展示的项目线数量，超出部分合并为其他
const MAX_TREND_PROJECTS = 8

// 趋势图项目线配色，覆盖不同项目线以保证区分度
const TREND_COLORS = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#8a5cf6', '#00b4d8', '#d6408a', '#19be6b', '#f39c12']

const props = defineProps<{ range: StatsRange }>()
const loading = ref(false)
const trendRef = ref<HTMLDivElement | null>(null)
const trendData = ref<TrendData>({ dates: [], series: [] })

/**
 * 拉取选中时段的历史数据并按项目聚合任务数量走势
 */
async function loadTrend() {
  loading.value = true
  try {
    const days = await ipc.queryHistory({
      startDate: props.range.start,
      endDate: props.range.end,
    })
    const isYear = typeof props.range.calendar === 'number'

    // 生成完整时间点，年模式按月、月模式按日，保证走势连续
    const dates: string[] = []
    if (isYear) {
      const year = props.range.calendar as number
      for (let m = 1; m <= 12; m++) dates.push(`${year}-${String(m).padStart(2, '0')}`)
    } else {
      const cal = String(props.range.calendar)
      const year = Number(cal.slice(0, 4))
      const month = Number(cal.slice(5, 7))
      const lastDay = new Date(year, month, 0).getDate()
      for (let d = 1; d <= lastDay; d++) dates.push(`${cal}-${String(d).padStart(2, '0')}`)
    }

    const dateProjects = new Map<string, Map<string, number>>()
    const projectTotal = new Map<string, number>()
    for (const day of days) {
      const key = isYear ? day.date.slice(0, 7) : day.date
      let pm = dateProjects.get(key)
      if (!pm) {
        pm = new Map()
        dateProjects.set(key, pm)
      }
      for (const t of day.tasks) {
        const project = t.rawProjectName || '未命名项目'
        pm.set(project, (pm.get(project) || 0) + 1)
        projectTotal.set(project, (projectTotal.get(project) || 0) + 1)
      }
    }

    // 按总量取前 N 个项目，其余合并为其他
    const topNames = Array.from(projectTotal.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TREND_PROJECTS)
      .map(([name]) => name)
    const topSet = new Set(topNames)

    const series = topNames.map((name) => ({
      name,
      values: dates.map((key) => dateProjects.get(key)?.get(name) || 0),
    }))
    series.push({
      name: '其他',
      values: dates.map((key) => {
        const pm = dateProjects.get(key)
        if (!pm) return 0
        let sum = 0
        for (const [p, count] of pm) {
          if (!topSet.has(p)) sum += count
        }
        return sum
      }),
    })

    trendData.value = { dates, series }
  } catch (e: any) {
    logStore.addLog('error', '趋势数据加载失败: ' + (e?.message || e))
    trendData.value = { dates: [], series: [] }
  } finally {
    loading.value = false
  }
}

watch(() => props.range, loadTrend, { immediate: true })

useChartRoll({
  chartRef: trendRef,
  dataSource: trendData,
  xAxis: (data: TrendData) => data.dates,
  generateOption: (data: TrendData) => {
    if (!data || !data.series.length) return {}
    const colors = getThemeTextColors()
    return {
      backgroundColor: 'transparent',
      tooltip: {
        ...getGlassTooltipStyle(isDarkTheme()),
        trigger: 'axis',
        appendToBody: true,
        formatter: (params: any) => {
          const sorted = params
            .filter((item: any) => item.seriesName !== '其他')
            .sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0))
          const lines = sorted.map((item: any) => {
            const color = item.color?.colorStops ? item.color.colorStops[0]?.color : item.color
            return tooltipRow(color, `${item.seriesName}: ${item.value ?? 0}`)
          })
          // 全部项目（含其他）在选中时间点的任务数合计
          const total = params.reduce((sum: number, item: any) => sum + (item.value ?? 0), 0)
          const borderColor = isDarkTheme() ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'
          const totalRow = `<div style="margin-top:4px;padding-top:4px;border-top:1px solid ${borderColor};font-weight:600;">总数: ${total}</div>`
          return `<div style="margin-bottom:4px;font-weight:600;">${sorted[0]?.axisValue ?? ''}</div>${lines.join('')}${totalRow}`
        },
      },
      legend: {
        show: true,
        type: 'scroll',
        top: 10,
        textStyle: { color: colors.secondary, fontSize: 11 },
        pageTextStyle: { color: colors.secondary },
        pageIconColor: colors.secondary,
        pageIconInactiveColor: colors.secondary,
      },
      grid: { left: 50, right: 20, top: 70, bottom: 24 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        axisLabel: { color: colors.secondary },
        axisLine: { lineStyle: { color: colors.secondary } },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: colors.secondary },
        splitLine: { lineStyle: { color: colors.secondary, opacity: 0.3 } },
      },
      series: data.series.map((s, i) => {
        const color = TREND_COLORS[i % TREND_COLORS.length]
        return {
          name: s.name,
          type: 'line',
          smooth: true,
          symbol: 'none',
          data: s.values,
          lineStyle: { width: 2 },
          itemStyle: { color },
          areaStyle: { color: createAreaGradient(color) },
        }
      }),
    }
  },
  maxLength: -1,
})
</script>

<style scoped>
.trend-stats {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.trend-skeleton {
  flex: 1;
  min-height: 0;
}
.trend-stats-body {
  width: 100%;
  flex: 1;
  min-height: 0;
}
</style>
