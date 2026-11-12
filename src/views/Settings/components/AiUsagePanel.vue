<!--
 * @Author: Himmeltala
 * @Date: 2026-11-12 09:20:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-12 09:40:00
 * @FilePath: \src\views\Settings\components\AiUsagePanel.vue
 * @Description: AI token 用量统计，按今天、最近若干天或全部展示用量柱状图
-->
<template>
  <div class="ai-usage settings-extra">
    <div class="ai-usage-bar">
      <el-radio-group v-model="range" size="small">
        <el-radio-button v-for="opt in AI_USAGE_RANGE_OPTIONS" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </el-radio-button>
      </el-radio-group>
      <span class="ai-usage-meta">
        <template v-if="summary">
          请求 {{ summary.requests }} 次 · 输入 {{ formatTokens(totalPrompt) }} · 输出 {{ formatTokens(totalCompletion) }} · 合计
          {{ formatTokens(totalPrompt + totalCompletion) }}
        </template>
        <template v-else-if="loading">统计中…</template>
      </span>
    </div>

    <ChartExportFrame @export="exportChart">
      <div ref="usageRef" class="ai-usage-chart"></div>
    </ChartExportFrame>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import ChartExportFrame from '@/components/ChartExportFrame.vue'
import { useChartRoll, getThemeTextColors, isDarkTheme } from '@/composables/useEcharts'
import { getGlassTooltipStyle, tooltipRow } from '@/utils/color'
import { getAiUsageSummary } from '@/services/ai/chat'
import { AI_USAGE_RANGE_OPTIONS } from '@/types/aiUsage'
import type { AiUsageRange, AiUsageSummary } from '@/types/aiUsage'
import { useLogStore } from '@/stores/log.store'
import { getErrorMessage } from '@/utils/error'

// 输入与输出 token 的配色，堆叠后即 token 总量
const PROMPT_COLOR = '#409eff'
const COMPLETION_COLOR = '#67c23a'

const usageRef = ref<HTMLDivElement | null>(null)
const logStore = useLogStore()
const range = ref<AiUsageRange>(7)
const summary = ref<AiUsageSummary | null>(null)
const loading = ref(false)

// 把汇总结果摊平成一维序列，今天视图按小时、其余范围按天
const chartData = ref<{ labels: string[]; promptTokens: number[]; completionTokens: number[] }>({
  labels: [],
  promptTokens: [],
  completionTokens: [],
})

const totalPrompt = computed(() => chartData.value.promptTokens.reduce((s, v) => s + v, 0))
const totalCompletion = computed(() => chartData.value.completionTokens.reduce((s, v) => s + v, 0))

/**
 * 把 token 数格式化成便于阅读的短文本
 * @param {number} n token 数量
 * @returns {string} 格式化结果
 */
function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)} M`
  if (n >= 1000) return `${(n / 1000).toFixed(2)} K`
  return String(n)
}

// 图上展示的是 token 总计，因此按输入输出两段堆叠
const { getDataURL } = useChartRoll({
  chartRef: usageRef,
  dataSource: chartData,
  xAxis: (data) => data.labels,
  generateOption: (data) => {
    const colors = getThemeTextColors()
    return {
      backgroundColor: 'transparent',
      tooltip: {
        ...getGlassTooltipStyle(isDarkTheme()),
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        appendToBody: true,
        formatter: (params: any) => {
          const prompt = params[0]?.value ?? 0
          const completion = params[1]?.value ?? 0
          const rows = [
            tooltipRow(PROMPT_COLOR, `输入: ${prompt}`),
            tooltipRow(COMPLETION_COLOR, `输出: ${completion}`),
          ]
          const borderColor = isDarkTheme() ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'
          const totalRow = `<div style="margin-top:4px;padding-top:4px;border-top:1px solid ${borderColor};font-weight:600;">合计: ${prompt + completion}</div>`
          return `<div style="margin-bottom:4px;font-weight:600;">${params[0]?.axisValue ?? ''}</div>${rows.join('')}${totalRow}`
        },
      },
      legend: {
        show: true,
        top: 0,
        textStyle: { color: colors.secondary, fontSize: 11 },
      },
      grid: { left: 50, right: 20, top: 34, bottom: 24 },
      xAxis: {
        type: 'category',
        data: data.labels,
        axisLabel: { color: colors.secondary },
        axisLine: { lineStyle: { color: colors.secondary } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: colors.secondary },
        splitLine: { lineStyle: { color: colors.secondary, opacity: 0.3 } },
      },
      series: [
        {
          name: '输入',
          type: 'bar',
          stack: 'token',
          barMaxWidth: 24,
          data: data.promptTokens,
          itemStyle: { color: PROMPT_COLOR },
        },
        {
          name: '输出',
          type: 'bar',
          stack: 'token',
          barMaxWidth: 24,
          data: data.completionTokens,
          itemStyle: { color: COMPLETION_COLOR },
        },
      ],
    }
  },
  maxLength: -1,
})

// 把汇总结果摊平；今天视图的 24 个小时点合并到一个分类轴上
function flatten(data: AiUsageSummary): typeof chartData.value {
  return {
    labels: data.points.flatMap((p) => p.labels),
    promptTokens: data.points.flatMap((p) => p.promptTokens),
    completionTokens: data.points.flatMap((p) => p.completionTokens),
  }
}

// 按当前范围向主进程取用量并刷新图表
async function loadSummary(): Promise<void> {
  loading.value = true
  try {
    summary.value = await getAiUsageSummary(range.value)
    chartData.value = flatten(summary.value)
  } catch (e) {
    logStore.addLog('error', '用量统计读取失败: ' + getErrorMessage(e, String(e)))
  } finally {
    loading.value = false
  }
}

// 导出当前图表，文件名带上统计范围便于区分
function exportChart(): void {
  const label = AI_USAGE_RANGE_OPTIONS.find((o) => o.value === range.value)?.label || ''
  getDataURL({ title: `AI 用量-${label}` })
}

// 切换范围时由 loadSummary 取数，watch 统一处理
watch(range, () => loadSummary())
onMounted(() => loadSummary())
</script>

<style scoped>
.ai-usage {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 420px;
}
.ai-usage-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.ai-usage-meta {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.ai-usage-chart {
  width: 100%;
  flex: 1;
  min-height: 0;
}
</style>
