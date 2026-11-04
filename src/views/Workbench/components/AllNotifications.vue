<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-19 22:30:02
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-07-30 13:41:05
 * @FilePath: \src\views\Workbench\components\AllNotifications.vue
 * @Description: 全部通知列表（分页）
-->

<template>
  <div class="all-table-area">
    <el-scrollbar>
      <el-table
        border
        :data="pagedData"
        stripe
        style="width: 100%"
        v-loading="loading"
        @selection-change="onSelectionChange"
      >
        <template #empty>
          <el-empty :description="loading ? '加载中...' : '暂无数据'" />
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
      </el-table>
    </el-scrollbar>
    <div class="pagination-bar">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="totalCount"
        layout="total, sizes, prev, pager, next"
        :page-sizes="pageSizeList"
        background
        @current-change="loadData"
        @size-change="onPageSizeChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useLogStore } from '@/stores/log.store'
import type { NotificationElement } from '@/types/api'
import { statusTagType, workPackageUrl, formatTime, PAGE_SIZE_LIST } from '@/utils/tag'
import { compareTaskOrder, type TaskOrderFields } from '@/services/taskOrder'

const store = useSettingsStore()
const logStore = useLogStore()

const notifications = ref<NotificationElement[]>([])
const totalCount = ref(0)
const currentPage = ref(1)
const pageSize = ref(15)
const loading = ref(false)
const selectedRows = ref<NotificationElement[]>([])

const pageSizeList = PAGE_SIZE_LIST

// 当前页按平台状态、平台类型排序展示，底层数据保持平台返回顺序
const pagedData = computed(() =>
  [...notifications.value].sort((a, b) => compareTaskOrder(toOrderFields(a), toOrderFields(b))),
)

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

function onPageSizeChange() {
  // 页码重置为 1 时由 current-change 事件统一触发加载，避免重复请求
  if (currentPage.value !== 1) {
    currentPage.value = 1
  } else {
    loadData()
  }
}

async function loadData() {
  const cookie = store.config.cookie
  if (!cookie) {
    logStore.addLog('warning', '请先在设置中填写 Cookie')
    return
  }

  loading.value = true
  logStore.addLog('info', `正在获取全部通知 (第${currentPage.value}页)...`)

  try {
    const res = await window.electron.fetchNotifications({
      cookie,
      onlyUnread: false,
      pageSize: pageSize.value,
      offset: currentPage.value,
    })
    const elements = res._embedded?.elements || []
    notifications.value = elements
    selectedRows.value = []
    emit('selection-change', [])
    totalCount.value = res.total || 0
    logStore.addLog(
      'success',
      `获取全部通知: 第${currentPage.value}页 ${elements.length} 条，共 ${totalCount.value} 条`,
    )
  } catch (e: any) {
    logStore.addLog('error', `获取通知失败: ${e.message}`)
  } finally {
    loading.value = false
  }
}

defineExpose({ loadData, getSelectedRows, count: totalCount, loading })
</script>

<style scoped>
.all-table-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.all-table-area .el-scrollbar {
  flex: 1;
}
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: var(--app-space-2) var(--app-space-3);
  flex-shrink: 0;
}
</style>
