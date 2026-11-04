<!--
 * @Author: zhengrenfu
 * @Date: 2026-11-04 15:19:52
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 15:45:00
 * @FilePath: \src\components\UpdatePanel.vue
 * @Description: 设置弹窗里的应用更新面板：当前版本、上次检查时间与手动检查入口
-->

<template>
  <div class="update-panel">
    <div class="update-row">
      <span class="update-label">当前版本</span>
      <span class="update-value">v{{ status?.currentVersion || '-' }}</span>
    </div>
    <div v-if="status?.lastCheckAt" class="update-row">
      <span class="update-label">上次检查</span>
      <span class="update-value">{{ formatTime(status.lastCheckAt) }}</span>
    </div>
    <div v-if="status && !status.packaged" class="update-row">
      <span class="update-label">运行模式</span>
      <span class="update-value">开发模式，可检查但不执行安装</span>
    </div>
    <div class="update-actions">
      <el-button type="primary" :loading="checking" :disabled="applying" @click="onCheck">检查更新</el-button>
      <span v-if="applying" class="update-tip">{{ progressText }}</span>
      <span v-else-if="message" class="update-tip" :class="tipClass">{{ message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useUpdater } from '@/composables/useUpdater'

const { status, checking, applying, progress, loadStatus, runCheck, offerUpdate } = useUpdater()

const message = ref('')
const messageType = ref<'info' | 'success' | 'error'>('info')

const tipClass = computed(() => `is-${messageType.value}`)

const progressText = computed(() => {
  const p = progress.value
  if (!p) return '正在准备更新包...'
  const phase = p.phase === 'copy' ? '复制' : '下载'
  return `${phase}更新包 ${p.percent}%`
})

/**
 * 格式化时间为 YYYY-MM-DD HH:mm
 * @param {string} iso ISO 时间字符串
 * @returns {string} 格式化结果，无法解析时返回原文
 */
function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function onCheck() {
  message.value = ''
  const result = await runCheck(true)
  if (!result) {
    message.value = '检查更新失败，请查看日志面板'
    messageType.value = 'error'
    return
  }
  if (result.error) {
    message.value = result.error
    messageType.value = 'error'
    return
  }
  if (!result.hasUpdate) {
    message.value = '当前已是最新版本'
    messageType.value = 'success'
    return
  }
  message.value = `发现新版本 ${result.version || ''}`
  messageType.value = 'info'
  const started = await offerUpdate(result)
  if (started) {
    message.value = '安装程序已启动，程序即将退出'
    messageType.value = 'success'
  }
}

onMounted(loadStatus)
</script>

<style scoped>
.update-panel {
  margin-top: var(--app-space-4);
  padding-top: var(--app-space-4);
  border-top: 1px dashed var(--el-border-color);
}
.update-row {
  display: flex;
  gap: var(--app-space-3);
  font-size: var(--el-font-size-small);
  line-height: 1.8;
}
.update-label {
  color: var(--el-text-color-secondary);
  width: 72px;
  flex-shrink: 0;
}
.update-value {
  color: var(--el-text-color-regular);
  word-break: break-all;
}
.update-actions {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  margin-top: var(--app-space-2);
}
.update-tip {
  font-size: var(--el-font-size-small);
}
.update-tip.is-info {
  color: var(--el-color-primary);
}
.update-tip.is-success {
  color: var(--el-color-success);
}
.update-tip.is-error {
  color: var(--el-color-danger);
}
</style>
