<!--
 * @Author: zhengrenfu
 * @Date: 2026-09-14 10:00:00
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 14:21:53
 * @FilePath: /src/views/HistoryTask/components/ToolBar.vue
 * @Description: 历史任务工具栏组件，按钮可用状态与操作结果由父组件通过状态对象与事件驱动
-->
<template>
  <div class="page-toolbar">
    <div class="toolbar-actions">
      <el-button @click="emit('save')">
        <el-icon><Check /></el-icon>保存
      </el-button>
      <el-dropdown @command="(cmd: string) => emit('delete', cmd)" :disabled="!hasSelection && !hasTotal">
        <el-button :disabled="!hasSelection && !hasTotal">
          <el-icon><Delete /></el-icon>删除<el-icon style="margin-left: 2px"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="selected" :disabled="!hasSelection">删除选中</el-dropdown-item>
            <el-dropdown-item command="range" :disabled="!hasTotal">删除范围内</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-dropdown @command="(cmd: string) => emit('sync-check', cmd)" :disabled="!hasSelection && !hasRange">
        <el-button v-if="state.syncing" type="danger" @click.stop="emit('abort-sync')">
          <el-icon><CircleClose /></el-icon>停止同步
        </el-button>
        <el-button v-else-if="state.checking" type="danger" @click.stop="emit('abort-check')">
          <el-icon><CircleClose /></el-icon>停止审查
        </el-button>
        <el-button v-else :disabled="!hasSelection && !hasRange">
          <el-icon><Connection /></el-icon>同步、审查<el-icon style="margin-left: 2px"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="sync" :disabled="!hasSelection && !hasRange">同步</el-dropdown-item>
            <el-dropdown-item command="aiCheck" :disabled="!hasSelection && !hasRange">AI 审查</el-dropdown-item>
            <el-dropdown-item command="syncAiCheck" :disabled="!hasSelection && !hasRange"
              >同步与 AI 审查</el-dropdown-item
            >
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-dropdown @command="(cmd: string) => emit('copy', cmd)" :disabled="!canCopy">
        <el-button :disabled="!canCopy">
          <el-icon><CopyDocument /></el-icon>复制任务<el-icon style="margin-left: 2px"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="plain" :disabled="!canCopy">复制任务（不带平台自评时长）</el-dropdown-item>
            <el-dropdown-item command="withEst" :disabled="!canCopy">复制任务（带平台自评时长）</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-dropdown @command="(cmd: string) => emit('export', cmd)" :disabled="!hasSelection && !hasRange">
        <el-button :disabled="!hasSelection && !hasRange" :loading="state.exporting">
          <el-icon><Download /></el-icon>导出<el-icon style="margin-left: 2px"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="selected" :disabled="!hasSelection">导出选中</el-dropdown-item>
            <el-dropdown-item command="range" :disabled="!hasRange">导出范围内</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-dropdown @command="(cmd: string) => emit('backup', cmd)">
        <el-button :loading="state.backingUp">
          <el-icon><Folder /></el-icon>备份<el-icon style="margin-left: 2px"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="backup">立即备份</el-dropdown-item>
            <el-dropdown-item command="restore">恢复备份</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-tag v-if="state.autoSyncEnabled" type="success" effect="plain" style="margin-left: 8px"> 自动同步 </el-tag>
      <span v-if="state.lastSyncTime" class="last-time">上次: {{ state.lastSyncTime }}</span>
      <el-tag v-if="state.backupEnabled" type="success" effect="plain" style="margin-left: 8px"> 自动备份 </el-tag>
      <span v-if="state.lastBackupTime" class="last-time">上次: {{ state.lastBackupTime }}</span>
    </div>
  </div>
</template>

<script lang="ts">
export interface ToolbarState {
  selectedCount: number
  pageCount: number
  rangeCount: number
  totalCount: number
  /** 同步中；同步后接检查期间也为真 */
  syncing: boolean
  /** 审查中；同步后接审查期间也为真 */
  checking: boolean
  exporting: boolean
  backingUp: boolean
  autoSyncEnabled: boolean
  /** 上次同步时间展示文本 */
  lastSyncTime: string
  backupEnabled: boolean
  /** 上次备份时间展示文本 */
  lastBackupTime: string
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowDown,
  Check,
  CircleClose,
  Connection,
  CopyDocument,
  Delete,
  Download,
  Folder,
} from '@element-plus/icons-vue'

const props = defineProps<{ state: ToolbarState }>()
const emit = defineEmits<{
  (e: 'save'): void
  (e: 'delete', cmd: string): void
  (e: 'sync-check', cmd: string): void
  (e: 'copy', cmd: string): void
  (e: 'export', cmd: string): void
  (e: 'backup', cmd: string): void
  (e: 'abort-sync'): void
  (e: 'abort-check'): void
}>()

const hasSelection = computed(() => props.state.selectedCount > 0)
const hasRange = computed(() => props.state.rangeCount > 0)
const hasTotal = computed(() => props.state.totalCount > 0)
// 有勾选时复制勾选的，无勾选时复制当前页
const canCopy = computed(() => hasSelection.value || props.state.pageCount > 0)
</script>

<style scoped>
.page-toolbar {
  display: flex;
  align-items: center;
  gap: var(--app-gap-toolbar);
  padding: var(--app-padding-toolbar);
  background: var(--el-bg-color-overlay);
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
}
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: var(--app-gap-toolbar);
}
.last-time {
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  margin-left: 4px;
}
</style>
