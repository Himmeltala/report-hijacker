<!--
 * @Author: Himmeltala
 * @Date: 2026-11-08 17:54:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-08 17:54:00
 * @FilePath: \src\components\ChartExportFrame.vue
 * @Description: 图表容器，鼠标移入时在右上角浮出导出按钮，点击后交由父组件调用图表的导出方法
-->
<template>
  <div class="chart-frame">
    <slot />
    <el-button
      class="chart-export-btn"
      size="small"
      circle
      :icon="Download"
      title="导出图片"
      @click="$emit('export')"
    />
  </div>
</template>

<script setup lang="ts">
import { Download } from '@element-plus/icons-vue'

defineEmits<{ export: [] }>()
</script>

<style scoped>
.chart-frame {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.chart-export-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 2;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.chart-frame:hover .chart-export-btn,
.chart-export-btn:focus-visible {
  opacity: 1;
}
</style>
