<!--
 * @Author: zhengrenfu
 * @Date: 2026-11-04 15:20:00
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 16:30:00
 * @FilePath: \src\components\MarkdownText.vue
 * @Description: Markdown 渲染组件，用于展示 AI 审查结论
-->

<template>
  <div class="markdown-text" v-html="html"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'

const props = defineProps<{
  text?: string | null
}>()

// 先转义尖括号，避免结论里的原始 HTML 被当成标签渲染
const html = computed(() =>
  marked.parse((props.text || '').replace(/</g, '&lt;'), { async: false, gfm: true, breaks: true }),
)
</script>

<style scoped>
.markdown-text {
  font-size: var(--el-font-size-small);
  line-height: 1.85;
  word-break: break-word;
}
.markdown-text :deep(> :first-child) {
  margin-top: 0;
}
.markdown-text :deep(> :last-child) {
  margin-bottom: 0;
}
.markdown-text :deep(h1),
.markdown-text :deep(h2),
.markdown-text :deep(h3),
.markdown-text :deep(h4) {
  font-size: 13px;
  font-weight: 600;
  margin: 12px 0 6px;
}
.markdown-text :deep(p) {
  margin: 0 0 10px;
}
.markdown-text :deep(ul),
.markdown-text :deep(ol) {
  margin: 0 0 10px;
  padding-left: 20px;
}
.markdown-text :deep(li) {
  margin: 3px 0 8px;
}
.markdown-text :deep(li:last-child) {
  margin-bottom: 0;
}
.markdown-text :deep(li > p) {
  margin: 0;
}
.markdown-text :deep(code) {
  padding: 1px 4px;
  background: var(--el-fill-color);
  border-radius: 3px;
  font-size: 12px;
}
.markdown-text :deep(pre) {
  padding: 8px;
  background: var(--el-fill-color);
  border-radius: var(--app-radius-sm);
  overflow: auto;
}
.markdown-text :deep(pre code) {
  padding: 0;
  background: none;
}
.markdown-text :deep(blockquote) {
  margin: 0 0 6px;
  padding-left: 8px;
  border-left: 2px solid var(--el-border-color);
  color: var(--el-text-color-secondary);
}
.markdown-text :deep(hr) {
  border: none;
  border-top: 1px solid var(--el-border-color-lighter);
  margin: 8px 0;
}
.markdown-text :deep(a) {
  color: var(--el-color-primary);
}
</style>
