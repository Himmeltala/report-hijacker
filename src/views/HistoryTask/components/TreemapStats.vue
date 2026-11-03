<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-28 01:12:17
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-28 12:14:04
 * @FilePath: /src/views/HistoryTask/components/TreemapStats.vue
 * @Description: 矩阵树形统计组件，按所选时段展示各文本项目的任务数量占比
-->
<template>
  <div class="treemap-stats">
    <el-skeleton v-if="loading" animated class="treemap-skeleton">
      <template #template>
        <el-skeleton-item variant="rect" style="width: 100%; height: 100%; border-radius: 8px" />
      </template>
    </el-skeleton>
    <el-empty v-else-if="!treemapData.length" description="该时段暂无任务" />
    <div v-else ref="treemapRef" class="treemap-stats-body"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useChartRoll, isDarkTheme, getThemeTextColors } from '@/composables/useEcharts'
import { getGlassTooltipStyle, tooltipRow } from '@/utils/color'
import { useLogStore } from '@/stores/log.store'
import { ipc } from '@/utils/ipc'

const logStore = useLogStore()

interface ProjectItem {
  name: string
  value: number
}

interface StatsRange {
  start: string
  end: string
  calendar: number | string
}

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

const props = defineProps<{ range: StatsRange }>()
const loading = ref(false)
const treemapData = ref<ProjectItem[]>([])
const treemapRef = ref<HTMLDivElement | null>(null)

/**
 * 拉取选中时段的历史数据并聚合各文本项目的任务数量
 */
async function loadTreemap() {
  loading.value = true
  try {
    const days = await ipc.queryHistory({
      startDate: props.range.start,
      endDate: props.range.end,
    })
    const countMap = new Map<string, number>()
    for (const day of days) {
      for (const t of day.tasks) {
        const key = t.rawProjectName || '未命名项目'
        countMap.set(key, (countMap.get(key) || 0) + 1)
      }
    }
    const sorted = Array.from(countMap, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    treemapData.value = sorted
  } catch (e: any) {
    logStore.addLog('error', '矩形树图数据加载失败: ' + (e?.message || e))
    treemapData.value = []
  } finally {
    loading.value = false
  }
}

watch(() => props.range, loadTreemap, { immediate: true })

useChartRoll({
  chartRef: treemapRef,
  dataSource: treemapData,
  xAxis: () => [],
  generateOption: (data: any) => {
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
</script>

<style scoped>
.treemap-stats {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.treemap-skeleton {
  flex: 1;
  min-height: 0;
}
.treemap-stats-body {
  width: 100%;
  flex: 1;
  min-height: 0;
}
</style>
