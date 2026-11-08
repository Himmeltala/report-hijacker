<!--
 * @Author: Himmeltala
 * @Date: 2026-11-08 16:25:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-08 16:25:00
 * @FilePath: \src\views\HistoryTask\modals\StatsDetailModal.vue
 * @Description: 统计详情弹窗，展示与上期对比的柱状图与明细
-->
<template>
  <el-dialog
    :model-value="visible"
    title="统计详情"
    width="520px"
    destroy-on-close
    @update:model-value="$emit('update:visible', $event)"
  >
    <template #header>
      <span>统计详情</span>
      <span v-if="prevRangeLabel" class="modal-subtitle">上期: {{ prevRangeLabel }}</span>
    </template>
    <CompareWithLastDrawer :chart-data="chartData" :detail-rows="detailRows" />
  </el-dialog>
</template>

<script setup lang="ts">
import CompareWithLastDrawer from '@/views/HistoryTask/components/CompareWithLastDrawer.vue'
import type { CompareChartItem, CompareDetailRow } from '@/types/chart'

withDefaults(
  defineProps<{
    visible: boolean
    prevRangeLabel?: string
    chartData?: CompareChartItem[]
    detailRows?: CompareDetailRow[]
  }>(),
  { chartData: () => [], detailRows: () => [] },
)

defineEmits<{
  close: []
  'update:visible': [value: boolean]
}>()
</script>

<style scoped>
.modal-subtitle {
  margin-left: 8px;
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
  font-weight: normal;
}
</style>
