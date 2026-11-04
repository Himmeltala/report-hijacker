<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-16 22:56:41
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-07-19 22:56:41
 * @FilePath: \src\views\Workbench\index.vue
 * @Description: 工作台
-->

<template>
  <div class="page-workbench">
    <div class="page-toolbar">
      <div class="toolbar-actions">
        <div>
          <el-button type="primary" @click="handleRefresh" :loading="unreadLoading || allLoading">
            <el-icon><Refresh /></el-icon>刷新
          </el-button>
        </div>
        <div>
          <el-button @click="handleAddToHistory" :disabled="selectedRows.length === 0" plain>
            加入历史任务 ({{ selectedRows.length }})
          </el-button>
        </div>
      </div>
    </div>

    <div class="tab-bar">
      <el-tabs type="card" v-model="activeTab" @tab-change="onTabChange">
        <el-tab-pane label="未读通知" name="unread" />
        <el-tab-pane label="全部通知" name="all" />
      </el-tabs>
    </div>

    <div class="page-content">
      <UnreadNotifications v-show="activeTab === 'unread'" ref="unreadRef" @selection-change="onChildSelectionChange" />
      <AllNotifications v-show="activeTab === 'all'" ref="allRef" @selection-change="onChildSelectionChange" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useLogStore } from '@/stores/log.store'
import { useModal } from '@/composables/useModal'
import { mergeTasksIntoHistory } from '@/services/historyPersistence'
import { workPackageUrl } from '@/utils/tag'
import { ipc } from '@/utils/ipc'
import type { NotificationElement } from '@/types/api'
import type { HistoryTaskItem } from '@/types/ipc'
import UnreadNotifications from '@/views/Workbench/components/UnreadNotifications.vue'
import AllNotifications from '@/views/Workbench/components/AllNotifications.vue'

const store = useSettingsStore()
const logStore = useLogStore()

const activeTab = ref<'unread' | 'all'>('unread')
const unreadRef = ref<InstanceType<typeof UnreadNotifications> | null>(null)
const allRef = ref<InstanceType<typeof AllNotifications> | null>(null)

const unreadLoading = computed(() => !!unreadRef.value?.loading)
const allLoading = computed(() => !!allRef.value?.loading)
const selectedRows = ref<NotificationElement[]>([])

function onTabChange() {
  selectedRows.value = []
  // 切换到全部且未加载时触发加载
  if (activeTab.value === 'all' && allRef.value) {
    allRef.value.loadData()
  }
  // 切回未读 Tab 时强制刷新，外部渠道（平台网页端）产生的已读或新增能及时体现
  if (activeTab.value === 'unread' && unreadRef.value) {
    unreadRef.value.loadData(true)
  }
}

function handleRefresh() {
  selectedRows.value = []
  if (activeTab.value === 'unread') {
    unreadRef.value?.loadData(true)
  } else {
    allRef.value?.loadData()
  }
}

const saveModal = useModal({
  component: () => import('@/views/TaskExtract/modals/SaveHistoryModal.vue'),
  autoCloseEvents: ['close', 'cancel', 'confirm'],
})

function onChildSelectionChange(rows: NotificationElement[]) {
  selectedRows.value = rows
}

/**
 * 加入历史任务：先选日期，再把勾选通知按工作包补全后写入该日期的历史文件
 */
async function handleAddToHistory() {
  const rows = selectedRows.value
  if (!rows.length) return
  if (!store.config.cookie) {
    logStore.addLog('warning', '请先在设置中填写 Cookie')
    return
  }

  const today = new Date().toISOString().slice(0, 10)
  let defaultDate = today
  try {
    defaultDate = (await ipc.storeGet('lastSaveHistoryDate')) || today
  } catch {
    defaultDate = today
  }

  saveModal.open(
    { taskCount: rows.length, defaultDate },
    {
      confirm: async (date: string) => {
        await saveNotificationsToHistory(rows, date)
        await ipc.storeSet('lastSaveHistoryDate', date)
      },
    },
  )
}

async function saveNotificationsToHistory(rows: NotificationElement[], date: string) {
  const now = new Date().toISOString()
  const tasks: HistoryTaskItem[] = rows.map((n) => ({
    serId: Date.now().toString(36) + Math.random().toString(36).slice(2, 10),
    serDate: date,
    rawSeq: 0,
    rawProjectName: n._projectName || n._links?.project?.title || '',
    rawTitle: n._links?.resource?.title || '',
    rawHandler: '',
    rawUrl: n._workPackageId ? workPackageUrl(n._workPackageId, store.config.apiBaseUrl) : '',
    rawScore: '',
    rawEstimatedHours: '',
    rawRemark: '',
    rawText: '',
    serSyncStatus: 'none',
    serWorkPackageId: null,
    remote: null,
    serSyncedAt: null,
    // 通知没有文本预期值，不做校验，进历史后需要时再手动检查
    serCheckResult: null,
    serCommentCheckResult: null,
    serPriority: null,
    serTimeLimit: null,
    serPostponed: false,
    serPostponedReason: '',
    serCreatedAt: now,
    serUpdatedAt: now,
  }))

  try {
    const results = await ipc.syncHistoryTasks(tasks, store.config.cookie)
    for (const r of results) {
      const task = tasks.find((t) => t.serId === r.taskId)
      if (!task || !r.exists || !r.remote) continue
      task.serSyncStatus = 'synced'
      task.serWorkPackageId = r.workPackageId
      task.remote = r.remote
      task.serSyncedAt = now
      task.rawHandler = r.remote._embedded?.responsible?.name || ''
    }
    const added = await mergeTasksIntoHistory(date, tasks)
    logStore.addLog('success', `已加入历史任务: 新增 ${added} 条`)
  } catch (e: any) {
    logStore.addLog('error', `加入历史任务失败: ${e.message}`)
  }
}

onMounted(() => {
  unreadRef.value?.loadData()
})
</script>

<style lang="scss" scoped>
.page-workbench {
  height: 100%;
  display: flex;
  flex-direction: column;
}
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
.toolbar-right {
  margin-left: auto;
  padding-right: 4px;
  display: flex;
  align-items: center;
  gap: var(--app-gap-toolbar);
}
.stats-text {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}
.stats-text strong {
  color: var(--el-color-primary);
}
.tab-bar {
  flex-shrink: 0;
  background: var(--el-bg-color-overlay);
}
.tab-bar .el-tabs {
  margin-bottom: -1px;
}
.tab-bar :deep(.el-tabs__header) {
  margin: 0 0 var(--app-space-2) 0;
}
.page-content {
  flex: 1;
  overflow: hidden;
  padding: var(--app-space-2) var(--app-space-2) 0;
  display: flex;
  flex-direction: column;
}
</style>
