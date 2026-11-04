<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14 01:34:51
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 14:21:53
 * @FilePath: \src\modals\TaskDetailModal.vue
 * @Description: 任务详情弹窗，展示平台字段与 AI 审查结论
-->

<template>
  <el-dialog
    :model-value="visible"
    title="任务详情"
    width="40vw"
    top="2vh"
    :close-on-click-modal="false"
    @update:model-value="$emit('close')"
  >
    <template v-if="result">
      <div v-if="result.serError" class="detail-error">{{ result.serError }}</div>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="任务ID">{{ result.serTaskId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="平台任务状态">
          {{ result.remote?._embedded?.status?.name || '-' }}
        </el-descriptions-item>
        <el-descriptions-item :span="2" label="平台项目">{{
          result.remote?._embedded?.project?.name || '-'
        }}</el-descriptions-item>
        <el-descriptions-item :span="2" label="平台标题">{{ result.remote?.subject || '-' }}</el-descriptions-item>
        <el-descriptions-item label="平台处理人">{{
          result.remote?._embedded?.responsible?.name || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="平台任务评价">
          <el-tag
            v-if="result.remote?._links?.customField62?.title"
            :type="evalTagType(result.remote?._links?.customField62?.title)"
          >
            {{ result.remote?._links?.customField62?.title }}
          </el-tag>
          <span v-else class="text-muted">-</span>
        </el-descriptions-item>
        <el-descriptions-item label="平台自评时长">{{ fmtHours(result.remote?.estimatedTime) }}</el-descriptions-item>
        <el-descriptions-item label="平台预估时长">{{ fmtHours(result.remote?.customField105) }}</el-descriptions-item>
        <el-descriptions-item label="平台开始日期">{{ result.remote?.startDate || '-' }}</el-descriptions-item>
        <el-descriptions-item label="平台截止日期">{{ result.remote?.dueDate || '-' }}</el-descriptions-item>
      </el-descriptions>

      <div v-if="aiConclusion" class="checks-section">
        <div class="checks-title">AI 审查</div>
        <div class="ai-conclusion">
          <MarkdownText :text="aiConclusion" />
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { TaskDetailResult } from '@/types/task'
import { convertIso8601ToHours } from '@/utils/parser'
import MarkdownText from '@/components/MarkdownText.vue'
import { evalTagType } from '@/utils/tag'

defineProps<{
  visible: boolean
  result: TaskDetailResult | null
  aiConclusion?: string | null
}>()

defineEmits<{
  close: []
}>()

function fmtHours(val: string | number | undefined | null): string {
  if (!val) return '-'
  // customField105 平台返回数字（预估时长），estimatedTime 为 ISO 字符串，统一转字符串处理
  const h = convertIso8601ToHours(String(val))
  return h > 0 ? h + ' h' : String(val)
}
</script>

<style scoped>
.detail-error {
  color: var(--el-color-danger);
  font-size: 12px;
  margin-bottom: 8px;
}
.checks-section {
  margin-top: 12px;
}
.checks-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}
.ai-conclusion {
  padding: 8px 10px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--app-radius-sm);
}
</style>
