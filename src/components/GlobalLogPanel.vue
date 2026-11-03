<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14 15:33:11
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-06 11:06:43
 * @FilePath: \src\components\GlobalLogPanel.vue
 * @Description: 描述
-->

<template>
  <div class="log-collapsed-bar" v-show="!logStore.panelVisible" @click="logStore.togglePanel()">
    <el-icon class="collapsed-icon"><ArrowUp /></el-icon>
    <span>运行日志</span>
  </div>
  <div
    class="global-log-panel"
    v-show="logStore.panelVisible"
    ref="panelRef"
    :style="{ height: logStore.panelHeight + 'px' }"
  >
    <div class="resize-handle" @mousedown.prevent="onDragStart"></div>

    <div class="log-toolbar">
      <span class="log-title">运行日志</span>
      <div class="log-toolbar-actions">
        <el-dropdown trigger="click" @command="onFilterCommand">
          <el-button plain>
            <el-icon style="margin-right: 4px"><Filter /></el-icon>筛选
            <span v-if="filteredCount < typeCount" class="filter-active-badge"
              >{{ filteredCount }}/{{ typeCount }}</span
            >
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="t in typeOptions" :key="t.key" :command="t.key">
                <el-checkbox
                  :model-value="logStore.filterTypes.has(t.key)"
                  @click.stop
                  @change="logStore.toggleFilterType(t.key)"
                  style="margin-right: 4px"
                />
                <span :style="{ color: t.color }">{{ t.label }}</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <div>
          <el-button plain @click="logStore.clearLogs()">清空</el-button>
        </div>
        <div>
          <el-button plain @click="logStore.togglePanel()">
            <el-icon style="margin-right: 4px"><ArrowDown /></el-icon>收起
          </el-button>
        </div>
      </div>
    </div>

    <el-scrollbar ref="logContent" class="log-body">
      <div v-for="(entry, i) in logStore.filteredLogs" :key="i" :class="['log-line', `log-${entry.type}`]">
        <span class="log-time">{{ entry.time }}</span>
        <span :class="['log-tag', `log-tag-${entry.type}`]">{{ typeLabel(entry.type) }}</span>
        <span class="log-msg">{{ entry.message }}</span>
      </div>
      <div v-if="logStore.filteredLogs.length === 0" class="log-empty">
        <el-empty description="暂无数据" />
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Filter, ArrowUp, ArrowDown } from '@element-plus/icons-vue'
import { useLogStore } from '@/stores/log.store'

const logStore = useLogStore()

const panelRef = ref<HTMLElement>()
const logContent = ref<any>()

const typeOptions = [
  { key: 'success', label: '成功', color: 'var(--el-color-success)' },
  { key: 'error', label: '报错', color: 'var(--el-color-danger)' },
  { key: 'warning', label: '警告', color: 'var(--el-color-warning)' },
  { key: 'info', label: '信息', color: 'var(--el-color-primary)' },
]

const typeCount = computed(() => typeOptions.length)
const filteredCount = computed(() => logStore.filterTypes.size)

function typeLabel(type: string): string {
  const map: Record<string, string> = { success: '成功', error: '报错', warning: '警告', info: '信息' }
  return map[type] || type
}

function onFilterCommand(key: string) {
  logStore.toggleFilterType(key)
}

// 拖拽调整大小

let dragState: { startY: number; startH: number } | null = null

function onDragStart(e: MouseEvent) {
  dragState = { startY: e.clientY, startH: logStore.panelHeight }
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e: MouseEvent) {
  if (!dragState) return
  const delta = dragState.startY - e.clientY
  logStore.setPanelHeight(Math.max(60, Math.min(800, dragState.startH + delta)))
}

async function onDragEnd() {
  if (!dragState) return
  dragState = null
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  await logStore.saveSetting('logPanelHeight', logStore.panelHeight)
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
})

// 自动滚动

let wrapEl: HTMLElement | null = null

onMounted(() => {
  wrapEl = logContent.value?.wrapRef ?? null
})

watch(
  () => logStore.logs.length,
  () => {
    requestAnimationFrame(() => {
      if (wrapEl) wrapEl.scrollTop = wrapEl.scrollHeight
    })
  },
  { flush: 'post' },
)
</script>

<style scoped>
.log-collapsed-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--app-space-2);
  padding: 10px 8px 11px 8px;
  cursor: pointer;
  border-top: 1px solid var(--el-border-color);
  background: var(--el-fill-color-blank);
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}
.log-collapsed-bar:hover {
  background: var(--el-fill-color-light);
}
.collapsed-icon {
  color: var(--el-color-primary);
}
.collapsed-expand {
  margin-left: auto;
}
.global-log-panel {
  flex-shrink: 0;
  border-top: 1px solid var(--el-border-color);
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--el-bg-color);
}
.resize-handle {
  height: 4px;
  cursor: ns-resize;
  flex-shrink: 0;
  background: transparent;
  position: relative;
  z-index: 1;
}
.resize-handle:hover {
  background: var(--el-color-primary-light-5);
}
.log-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 8px 6px 8px;
  background: var(--el-fill-color-blank);
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
}
.log-title {
  font-size: var(--el-font-size-extra-small);
  font-weight: var(--el-font-weight-primary);
  color: var(--el-text-color-primary);
}
.log-toolbar-actions {
  display: flex;
  align-items: center;
  gap: var(--app-gap-toolbar);
}
.filter-active-badge {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-color-primary);
  margin-left: var(--app-space-1);
}
.log-body {
  flex: 1;
  padding: var(--app-padding-compact);
  font-family: var(--el-font-family);
  font-size: var(--el-font-size-extra-small);
  line-height: 1.6;
  background: var(--el-bg-color);
}
.log-line {
  display: flex;
  gap: var(--app-space-2);
  padding: 1px 0;
}
.log-time {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
  font-size: var(--el-font-size-extra-small);
}
.log-tag {
  flex-shrink: 0;
  font-size: var(--el-font-size-extra-small);
  font-weight: var(--el-font-weight-primary);
  min-width: 32px;
}
.log-tag-success {
  color: var(--el-color-success);
}
.log-tag-error {
  color: var(--el-color-danger);
}
.log-tag-warning {
  color: var(--el-color-warning);
}
.log-tag-info {
  color: var(--el-color-primary);
}
.log-info .log-msg {
  color: var(--el-text-color-primary);
}
.log-success .log-msg {
  color: var(--el-color-success);
}
.log-warning .log-msg {
  color: var(--el-color-warning);
}
.log-error .log-msg {
  color: var(--el-color-danger);
}
.log-empty {
  color: var(--el-text-color-placeholder);
  padding: var(--app-space-2) 0;
  text-align: center;
  font-size: var(--el-font-size-small);
}
</style>
