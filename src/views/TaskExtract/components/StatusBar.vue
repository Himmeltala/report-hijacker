<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14 21:36:19
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-07-14 00:31:31
 * @FilePath: \..\\src\\views\\ExportTask\\components\\StatusBar.vue
 * @Description: 描述
-->

<template>
  <div class="status-bar">
    <div class="status-left">
      <span class="status-item">任务: {{ taskCount }}</span>
      <span v-if="validCount > 0 || invalidCount > 0" class="status-item">
        校验:
        <span class="text-success">{{ validCount }} 通过</span>
        <span v-if="invalidCount > 0" class="text-danger"> / {{ invalidCount }} 失败</span>
      </span>
    </div>
    <div class="status-right"></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  taskCount: number
  validCount: number
  invalidCount: number
}>()
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--app-padding-compact);
  font-size: var(--el-font-size-extra-small);
  background: var(--el-bg-color-overlay);
  border-top: 1px solid var(--el-border-color);
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}
.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
}
.status-item {
  display: inline-flex;
  align-items: center;
}
.clickable {
  cursor: pointer;
}
.clickable:hover {
  color: var(--el-color-primary);
}
.text-success {
  color: var(--el-color-success);
}
.text-danger {
  color: var(--el-color-danger);
}
</style>
