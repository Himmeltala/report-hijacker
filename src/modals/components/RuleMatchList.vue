<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-04 21:36:19
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04 16:20:21
 * @FilePath: \src\modals\components\RuleMatchList.vue
 * @Description: 规则匹配结果列表（评论区检查与边界校验共用）
-->

<template>
  <div class="checks-section">
    <div class="checks-title">
      {{ title }}（{{ modeLabel }}）
      <el-tag :type="overallPassed ? 'success' : 'danger'" class="section-status-tag">
        {{ overallPassed ? '通过' : '失败' }}
      </el-tag>
    </div>
    <div class="check-grid">
      <div
        v-for="(rule, i) in results"
        :key="i"
        class="check-item"
        :class="{ 'full-row': rule.matched || !!rule.error }"
      >
        <el-tag :type="rule.matched ? 'success' : 'danger'">
          {{ rule.matched ? '通过' : '未匹配' }}
        </el-tag>
        <span class="check-name">{{ rule.label || rule.pattern }}</span>
        <span v-if="rule.matched" class="check-detail"> 匹配: {{ rule.matchedContent || rule.pattern }} </span>
        <span v-else-if="rule.error" class="check-detail" style="color: var(--el-color-danger)">
          {{ rule.error }}
        </span>
        <span v-else class="check-detail">未匹配</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CommentRuleMatch } from '@/types/task'
import type { MatchMode } from '@/types/config'
import { isRulesPassed } from '@/services/validationRules'

const props = defineProps<{
  title: string
  results: CommentRuleMatch[]
  mode: MatchMode
}>()

const modeLabel = computed(() => (props.mode === 'all' ? '全部匹配' : '任一匹配'))

const overallPassed = computed(() => isRulesPassed(props.results, props.mode))
</script>

<style scoped>
.checks-section {
  margin-top: 12px;
}
.checks-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.section-status-tag {
  font-size: 11px;
}
.check-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--app-gap-toolbar, 8px);
}
.check-item {
  display: flex;
  align-items: center;
  gap: var(--app-gap-toolbar);
  padding: var(--app-space-1) 0;
  font-size: var(--el-font-size-small);
}
.check-item.full-row {
  grid-column: 1 / -1;
}
.check-name {
  min-width: 80px;
  font-weight: var(--el-font-weight-primary);
  white-space: nowrap;
}
.check-detail {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}
</style>
