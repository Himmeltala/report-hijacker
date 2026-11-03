<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14 01:34:51
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04 01:34:51
 * @FilePath: \src\modals\TaskDetailModal.vue
 * @Description: 任务校验详情弹窗
-->

<template>
  <el-dialog
    :model-value="visible"
    title="校验详情"
    width="40vw"
    top="2vh"
    :close-on-click-modal="false"
    @update:model-value="$emit('close')"
  >
    <template v-if="result">
      <div class="detail-header">
        <el-tag :type="result.serValid ? 'success' : 'danger'">
          {{ result.serValid ? '通过' : '失败' }}
        </el-tag>
        <span v-if="result.serError" class="detail-error">
          {{ result.serError }}
        </span>
      </div>

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

      <div v-if="result.serChecks && result.serChecks.length > 0" class="checks-section">
        <div class="checks-title">校验信息</div>
        <el-scrollbar max-height="60vh">
          <div class="checks-list">
            <template v-for="(c, i) in sortedChecks" :key="i">
              <div class="check-card" :class="{ 'is-fail': !c.passed }">
                <div class="check-card-head">
                  <el-tag :type="c.passed ? 'success' : 'danger'">
                    {{ c.passed ? '通过' : '失败' }}
                  </el-tag>
                  <span class="check-card-name">{{ c.name }}</span>
                  <span v-if="c.field" class="check-card-config">
                    平台字段: {{ c.field }}
                    <template v-if="c.expectedSource === 'text'"
                      >· 对比来源: 任务文本({{ c.expectedKey || '-' }})</template
                    >
                    <template v-else-if="c.expectedSource === 'config'"
                      >· 对比来源: 设置值({{ configKeyLabel(c.expectedKey) }})</template
                    >
                    <template v-else>· 对比来源: 平台自检</template>
                    <template v-if="c.compare">· 对比方式: {{ compareLabel(c.compare) }}</template>
                  </span>
                </div>
                <div class="check-card-body">
                  <span class="check-detail">{{ c.message || (c.passed ? '检查通过' : '检查不通过') }}</span>
                  <span v-if="!c.passed && c.expected !== undefined" class="check-detail">
                    预期: {{ c.expected }} / 实际: {{ c.actual }}
                  </span>
                </div>
              </div>
            </template>
          </div>
        </el-scrollbar>
      </div>

      <!-- 边界校验与评论区检查逐条结果（共用列表组件） -->
      <RuleMatchList
        v-if="result.serBoundaryResults && result.serBoundaryResults.length > 0"
        title="边界校验"
        :results="result.serBoundaryResults"
        :mode="(result.serBoundaryMatchMode as MatchMode) || 'any'"
      />
      <RuleMatchList
        v-if="commentResult && commentResult.length > 0"
        title="评论区检查"
        :results="commentResult"
        :mode="(commentMatchMode as MatchMode) || 'all'"
      />

      <!-- AI 审查结论（启用 AI 审查时有值） -->
      <div v-if="aiConclusion" class="checks-section">
        <div class="checks-title">AI 审查</div>
        <div class="ai-conclusion">{{ aiConclusion }}</div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ValidationResult, CommentRuleMatch } from '@/types/task'
import type { MatchMode } from '@/types/config'
import { convertIso8601ToHours } from '@/utils/parser'
import { evalTagType } from '@/utils/tag'
import RuleMatchList from '@/modals/components/RuleMatchList.vue'

const props = defineProps<{
  visible: boolean
  result: ValidationResult | null
  commentResult?: CommentRuleMatch[] | null
  commentMatchMode?: string
  aiConclusion?: string | null
}>()

// 失败项排前，同类项保持原顺序；「任务ID」只作内部标识，不在校验信息里展示
const sortedChecks = computed(() => {
  const checks = (props.result?.serChecks || []).filter((c) => c.name !== '任务ID')
  return [...checks].sort((a, b) => Number(a.passed) - Number(b.passed))
})

defineEmits<{
  close: []
}>()

function fmtHours(val: string | number | undefined | null): string {
  if (!val) return '-'
  // customField105 平台返回数字（预估时长），estimatedTime 为 ISO 字符串，统一转字符串处理
  const h = convertIso8601ToHours(String(val))
  return h > 0 ? h + ' h' : String(val)
}

// 对比方式中文名（与设置页任务校验选项一致）
function compareLabel(compare: string): string {
  const map: Record<string, string> = {
    equals: '全等',
    gt: '大于',
    gte: '大于等于',
    lt: '小于',
    lte: '小于等于',
    'diff-hours': '偏差小时',
    'field-diff': '字段偏差',
    'non-empty': '非空',
    'list-any': '白名单',
    'regex-any': '多条件或',
    'regex-all': '多条件且',
  }
  return map[compare] || compare
}

// 设置值来源的对比字段显示名：设置键映射业务名，未映射的键原样显示
function configKeyLabel(key?: string): string {
  if (!key) return '-'
  const map: Record<string, string> = {
    'validation.handlerName': '处理人',
  }
  return map[key] || key
}
</script>

<style scoped>
.detail-header {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.detail-error {
  color: var(--el-color-danger);
  font-size: 12px;
}
.checks-section {
  margin-top: 12px;
}
.checks-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}
.checks-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.check-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--app-radius-sm);
  padding: 6px 10px;
  font-size: var(--el-font-size-small);
}
.check-card.is-fail {
  border-color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}
.check-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.check-card-name {
  font-weight: var(--el-font-weight-primary);
  white-space: nowrap;
}
.check-card-config {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}
.check-card-body {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.check-detail {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}
.ai-conclusion {
  padding: 8px 10px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--app-radius-sm);
  font-size: var(--el-font-size-small);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
