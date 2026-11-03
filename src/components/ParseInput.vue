<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14 01:43:40
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-07-14 01:43:40
 * @FilePath: \..\\src\\components\\ParseInput.vue
 * @Description: 描述
-->

<template>
  <div class="input-section">
    <el-input
      :model-value="text"
      @update:model-value="$emit('update:text', $event)"
      type="textarea"
      :rows="6"
      :placeholder="placeholder"
      class="input-area"
    />
    <div v-if="(unrecognizedLines ?? []).length > 0" class="unrecognized-bar">
      <div class="unrecognized-title">{{ (unrecognizedLines ?? []).length }} 行格式无法识别：</div>
      <div v-for="(line, i) in unrecognizedLines" :key="i" class="unrecognized-line">
        <el-icon :size="12" style="flex-shrink: 0; margin-top: 2px"><WarningFilled /></el-icon>
        <span>{{ line }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { WarningFilled } from '@element-plus/icons-vue'

defineProps<{
  text: string
  placeholder?: string
  unrecognizedLines?: string[]
}>()

defineEmits<{
  'update:text': [value: string]
}>()
</script>

<style scoped>
.input-section {
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
  border-radius: var(--app-radius-base);
}
.input-area :deep(.el-textarea__inner) {
  font-family: var(--el-font-family);
  font-size: var(--el-font-size-small);
  line-height: 1.6;
}
.unrecognized-bar {
  padding: 6px 8px;
  background: var(--el-color-danger-light-9);
  border-top: 1px solid var(--el-color-danger-light-7);
}
.unrecognized-title {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-color-danger);
  font-weight: 600;
  margin-bottom: 4px;
}
.unrecognized-line {
  display: flex;
  gap: 4px;
  padding: 1px 0;
  font-size: var(--el-font-size-extra-small);
  font-family: var(--el-font-family);
  color: var(--el-color-danger);
  line-height: 1.5;
}
</style>
