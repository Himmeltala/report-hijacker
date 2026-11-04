<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-19 22:57:29
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-07-30 13:41:17
 * @FilePath: \src\views\Workbench\components\UnreadNotifications.vue
 * @Description: 未读通知列表
-->

<template>
  <div class="unread-table-area">
    <el-scrollbar>
      <el-table :data="pagedData" stripe border style="width: 100%" @selection-change="onSelectionChange">
        <template #empty>
          <el-empty description="暂无数据" />
        </template>
        <el-table-column align="center" type="selection" min-width="48" />
        <el-table-column align="center" fixed="left" label="链接" min-width="250">
          <template #default="{ row }">
            <el-link
              v-if="row._workPackageId"
              :href="workPackageUrl(row._workPackageId, store.config.apiBaseUrl)"
              target="_blank"
              type="primary"
              underline="never"
            >
              {{ workPackageUrl(row._workPackageId, store.config.apiBaseUrl) }}
            </el-link>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column align="center" fixed="left" label="项目名称" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row._projectName || row._links?.project?.title || '-' }}
          </template>
        </el-table-column>
        <el-table-column align="center" fixed="left" label="任务描述" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row._links?.resource?.title || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="任务类型" align="center" min-width="100">
          <template #default="{ row }">
            <el-tag :type="row._workPackageType === '缺陷' ? 'danger' : 'primary'">
              {{ row._workPackageType || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="任务状态" align="center" min-width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row._workPackageStatus)">
              {{ row._workPackageStatus || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作人" align="center" min-width="100">
          <template #default="{ row }">
            {{ row._links?.actor?.title || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="通知时间" min-width="140">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" align="center" fixed="right" min-width="240">
          <template #default="{ row }">
            <el-popconfirm
              :width="200"
              title="确认标记为已读？"
              confirm-button-text="确认"
              cancel-button-text="取消"
              @confirm="markAsRead(row)"
            >
              <template #reference>
                <el-button type="primary" text :loading="readingId === row.id"> 标记为已读 </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-scrollbar>
    <div class="pagination-bar">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="notifications.length"
        layout="total, sizes, prev, pager, next"
        :page-sizes="pageSizeList"
        background
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

import { useSettingsStore } from '@/stores/settings.store'
import { useLogStore } from '@/stores/log.store'
import type { NotificationElement } from '@/types/api'
import { getCache, setCache, removeCache } from '@/utils/cache'
import { statusTagType, workPackageUrl, formatTime, PAGE_SIZE_LIST } from '@/utils/tag'
import { compareTaskOrder, type TaskOrderFields } from '@/services/taskOrder'

const CACHE_TTL = 30 * 60 * 1000

const store = useSettingsStore()
const logStore = useLogStore()

/**
 * 获取当前档案的通知缓存键，避免档案切换后读取到上一档案的缓存数据
 * @returns {Promise<string>} 含档案标识的缓存键
 */
async function getCacheKey(): Promise<string> {
  let profile = 'default'
  try {
    profile = (await window.electron.profileCurrent()) || 'default'
  } catch {
    // 获取档案失败时使用默认键，仅影响缓存隔离效果
  }
  return `workbench_notifications_${profile}`
}

const notifications = ref<NotificationElement[]>([])
// 工作包 ID 对应其下所有未读通知 ID（含被去重隐藏的重复项），单条标记已读时用于整组标记
const wpNotificationIds = ref<Map<number, number[]>>(new Map())
const currentPage = ref(1)
const pageSize = ref(15)
const readingId = ref<number | null>(null)
const selectedRows = ref<NotificationElement[]>([])
const loading = ref(false)
// 已读操作进行中标志，与加载互斥避免陈旧响应回填列表
let mutating = false

const pageSizeList = PAGE_SIZE_LIST

/**
 * 当前页展示数据：按平台状态、平台类型排序，仅排当前页，不打乱底层顺序
 */
const pagedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return notifications.value
    .slice(start, start + pageSize.value)
    .sort((a, b) => compareTaskOrder(toOrderFields(a), toOrderFields(b)))
})

/**
 * 取排序字段
 * @param {NotificationElement} n 通知
 * @returns {TaskOrderFields} 排序字段
 */
function toOrderFields(n: NotificationElement): TaskOrderFields {
  return {
    status: n._workPackageStatus,
    type: n._workPackageType,
    date: n.createdAt,
    seq: n.id,
  }
}

const emit = defineEmits<{ 'selection-change': [rows: NotificationElement[]] }>()

function onSelectionChange(rows: NotificationElement[]) {
  selectedRows.value = rows
  emit('selection-change', rows)
}

function getSelectedRows(): NotificationElement[] {
  return [...selectedRows.value]
}

/**
 * 清空勾选，列表重载后旧勾选不再有效
 */
function clearSelection() {
  if (selectedRows.value.length === 0) return
  selectedRows.value = []
  emit('selection-change', [])
}

/**
 * 加载未读通知（带缓存）
 */
async function loadData(forceRefresh = false) {
  const cookie = store.config.cookie
  if (!cookie) return
  // 已读操作进行中不加载，避免旧响应回填已标记已读的条目
  if (mutating) return

  const cacheKey = await getCacheKey()
  if (!forceRefresh) {
    const cached = getCache<{ visible: NotificationElement[]; wpIds?: Map<number, number[]> }>(cacheKey)
    if (cached) {
      notifications.value = cached.visible
      wpNotificationIds.value = cached.wpIds instanceof Map ? new Map(cached.wpIds) : new Map()
      clearSelection()
      return
    }
  }

  loading.value = true
  try {
    // 分页拉取全部未读通知，避免超过单页上限导致未读无法清空
    // offset 是页号，从 1 起逐页递增；页数上限防止服务端异常时一直返回满页导致死循环
    const all: NotificationElement[] = []
    let offset = 1
    const PAGE_SIZE = 100
    const MAX_PAGES = 10000
    for (;;) {
      const res = await window.electron.fetchNotifications({
        cookie,
        onlyUnread: true,
        pageSize: PAGE_SIZE,
        offset,
      })
      const elements = res._embedded?.elements || []
      all.push(...elements)
      if (elements.length < PAGE_SIZE) break
      offset += 1
      if (offset > MAX_PAGES) {
        logStore.addLog('warning', `未读通知超过 ${PAGE_SIZE * MAX_PAGES} 条，已停止拉取`)
        break
      }
    }
    // 构建工作包 ID 到通知 ID 列表的映射（无工作包的通知无法整组标记，跳过）
    const wpIdMap = new Map<number, number[]>()
    for (const el of all) {
      const wpId = el._workPackageId
      if (wpId == null) continue
      const list = wpIdMap.get(wpId)
      if (list) list.push(el.id)
      else wpIdMap.set(wpId, [el.id])
    }
    wpNotificationIds.value = wpIdMap

    // 按工作包 ID 去重（无工作包的资源通知不展示，但保留在全部已读集合中）
    const seen = new Map<number, NotificationElement>()
    for (const el of all) {
      const wpId = el._workPackageId
      if (wpId === null) continue
      const existing = seen.get(wpId)
      if (!existing || el.createdAt > existing.createdAt) {
        seen.set(wpId, el)
      }
    }
    const deduped = Array.from(seen.values())

    notifications.value = deduped
    clearSelection()
    setCache(cacheKey, { visible: deduped, wpIds: wpIdMap }, CACHE_TTL)
    logStore.addLog('success', `获取未读通知: ${all.length} 条，去重后 ${deduped.length} 条`)
  } catch (e: any) {
    logStore.addLog('error', `获取通知失败: ${e.message}`)
  } finally {
    loading.value = false
  }
}

async function markAsRead(row: NotificationElement) {
  const cookie = store.config.cookie
  if (!cookie || readingId.value || mutating) return

  // 一个工作包可有多条未读通知，去重展示只显示最新一条；整组标记该工作包全部未读，
  // 避免刷新后同工作包的下一条通知又顶上来，造成“刚标记已读又出现”的假象
  const wpId = row._workPackageId
  const wpIds = wpId != null ? (wpNotificationIds.value.get(wpId) ?? [row.id]) : [row.id]
  // Map.get 返回的是 Vue 响应式代理数组，无法被 Electron 结构化克隆，转成纯数组再传 IPC
  const ids = Array.from(wpIds)

  mutating = true
  readingId.value = row.id
  try {
    await window.electron.markNotificationsRead({ ids, cookie })
    removeCache(await getCacheKey())
    const idSet = new Set(ids)
    notifications.value = notifications.value.filter((n) => !idSet.has(n.id))
    selectedRows.value = selectedRows.value.filter((n) => !idSet.has(n.id))
    emit('selection-change', [...selectedRows.value])
    if (wpId != null) wpNotificationIds.value.delete(wpId)
    logStore.addLog(
      'success',
      wpId != null ? `已标记工作包 #${wpId} 的 ${ids.length} 条通知为已读` : `已标记通知 #${row.id} 为已读`,
    )
  } catch (e: any) {
    // 失败时条目保留在列表里，不假装已读
    logStore.addLog('error', `标记已读失败: ${e.message}`)
  } finally {
    readingId.value = null
    mutating = false
  }
}

// 列表变化时修正页码
watch(notifications, () => {
  const maxPage = Math.max(1, Math.ceil(notifications.value.length / pageSize.value))
  if (currentPage.value > maxPage) {
    currentPage.value = maxPage
  }
})

defineExpose({
  loadData,
  getSelectedRows,
  loading,
})
</script>

<style scoped>
.unread-table-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.unread-table-area .el-scrollbar {
  flex: 1;
}
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: var(--app-space-2) var(--app-space-3);
  flex-shrink: 0;
}
</style>
