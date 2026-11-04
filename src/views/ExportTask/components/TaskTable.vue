<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14 01:26:41
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 14:21:53
 * @FilePath: \src\views\ExportTask\components\TaskTable.vue
 * @Description: 导出任务表格组件
-->

<template>
  <div class="table-wrapper">
    <el-scrollbar>
      <el-table border :data="props.tasks" stripe style="width: 100%">
        <template #empty>
          <el-empty description="暂无数据" />
        </template>
        <el-table-column align="center" fixed="left" label="链接" min-width="250" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link v-if="row.rawUrl" :href="row.rawUrl" target="_blank" type="primary" underline="never">
              {{ row.rawUrl }}
            </el-link>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column
          align="center"
          fixed="left"
          label="文本项目"
          min-width="150"
          prop="rawProjectName"
          show-overflow-tooltip
        >
          <template #default="{ row, $index }">
            <el-input
              v-if="editingIndex === $index"
              :model-value="editForm.rawProjectName"
              @update:model-value="editForm.rawProjectName = $event"
              @blur="saveEdit($index)"
              @keyup.enter="saveEdit($index)"
            />
            <span v-else class="cell-text" @dblclick="startEdit($index)">{{ row.rawProjectName }}</span>
          </template>
        </el-table-column>
        <el-table-column
          align="center"
          fixed="left"
          label="文本标题"
          min-width="220"
          prop="rawTitle"
          show-overflow-tooltip
        >
          <template #default="{ row, $index }">
            <el-input
              v-if="editingIndex === $index"
              :model-value="editForm.rawTitle"
              @update:model-value="editForm.rawTitle = $event"
              @blur="saveEdit($index)"
              @keyup.enter="saveEdit($index)"
            />
            <span v-else class="cell-text" @dblclick="startEdit($index)">{{ row.rawTitle }}</span>
          </template>
        </el-table-column>
        <el-table-column label="平台状态" align="center" min-width="100">
          <template #default="{ $index }">
            <el-tag
              v-if="props.detailResults[$index]?.remote?._embedded?.status?.name"
              :type="statusTagType(props.detailResults[$index].remote?._embedded?.status?.name)"
            >
              {{ props.detailResults[$index].remote?._embedded?.status?.name }}
            </el-tag>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="平台类型" align="center" min-width="100">
          <template #default="{ $index }">
            <el-tag
              v-if="props.detailResults[$index]?.remote?._embedded?.type?.name"
              :type="taskTypeTagType(props.detailResults[$index].remote?._embedded?.type?.name)"
            >
              {{ props.detailResults[$index].remote?._embedded?.type?.name }}
            </el-tag>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="平台评价" align="center" min-width="100">
          <template #default="{ $index }">
            <el-tag
              v-if="props.detailResults[$index]?.remote?._links?.customField62?.title"
              :type="evalTagType(props.detailResults[$index].remote?._links?.customField62?.title)"
            >
              {{ props.detailResults[$index].remote?._links?.customField62?.title }}
            </el-tag>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="文本预估时长" align="center" min-width="130">
          <template #default="{ $index }">
            <el-input-number
              v-if="editingIndex === $index"
              :model-value="Number(editForm.rawScore) || 0"
              :min="0"
              :step="0.5"
              :precision="1"
              controls-position="right"
              style="width: 70px"
              @update:model-value="editForm.rawScore = String($event)"
              @blur="saveEdit($index)"
            />
            <span v-else class="cell-text" @dblclick="startEdit($index)">{{ props.tasks[$index].rawScore }}</span>
          </template>
        </el-table-column>
        <el-table-column label="平台自评时长" align="center" min-width="130">
          <template #default="{ $index }">
            <span v-if="props.detailResults[$index]">{{
              convertIso8601ToHours(props.detailResults[$index].remote?.estimatedTime)
            }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="平台预估时长" align="center" min-width="130">
          <template #default="{ $index }">
            <span v-if="props.detailResults[$index]">{{
              props.detailResults[$index].remote?.customField105 || '-'
            }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="平台开始日期" align="center" min-width="120">
          <template #default="{ $index }">
            <span v-if="props.detailResults[$index]">{{ props.detailResults[$index].remote?.startDate || '-' }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="平台截止日期" align="center" min-width="120">
          <template #default="{ $index }">
            <span v-if="props.detailResults[$index]">{{ props.detailResults[$index].remote?.dueDate || '-' }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="平台工期" align="center" min-width="100">
          <template #default="{ $index }">
            <span v-if="props.detailResults[$index]?.remote?.duration">{{
              formatIso8601Duration(props.detailResults[$index].remote?.duration)
            }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" align="center" fixed="right" min-width="240">
          <template #default="{ $index }">
            <el-button v-if="props.detailResults[$index]" type="primary" text @click="showDetail($index)"
              >详情</el-button
            >
            <span v-else class="text-muted">-</span>
            <el-popconfirm title="确认删除?" @confirm="$emit('remove', $index)">
              <template #reference>
                <el-button type="danger" text>删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-scrollbar>

    <div v-if="(props.unrecognizedLines ?? []).length > 0" class="unrecognized-bar">
      <el-alert
        :title="`${(props.unrecognizedLines ?? []).length} 行格式无法识别`"
        type="warning"
        :closable="false"
        show-icon
      >
        <template #default>
          <div v-for="(line, i) in props.unrecognizedLines ?? []" :key="i" class="unrecognized-line">
            {{ line }}
          </div>
        </template>
      </el-alert>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import type { TaskItem, TaskDetailResult } from '@/types/task'
import { convertIso8601ToHours, formatIso8601Duration } from '@/utils/parser'
import { statusTagType, evalTagType, taskTypeTagType } from '@/utils/tag'

const props = defineProps<{
  tasks: TaskItem[]
  detailResults: (TaskDetailResult | null)[]
  unrecognizedLines?: string[]
}>()

const emit = defineEmits<{
  remove: [index: number]
  update: [index: number, data: Partial<TaskItem>]
  detail: [index: number]
}>()

const editingIndex = ref(-1)
const editForm = reactive<Partial<TaskItem>>({})

function startEdit(index: number) {
  const task = props.tasks[index]
  if (!task) return
  editingIndex.value = index
  editForm.rawProjectName = task.rawProjectName
  editForm.rawTitle = task.rawTitle
  editForm.rawScore = task.rawScore
}

function saveEdit(index: number) {
  if (editingIndex.value !== index) return
  const changed: Partial<TaskItem> = {}
  for (const key of ['rawProjectName', 'rawTitle', 'rawScore'] as const) {
    if (editForm[key] !== props.tasks[index]?.[key]) {
      ;(changed as any)[key] = editForm[key]
    }
  }
  if (Object.keys(changed).length > 0) {
    emit('update', index, changed)
  }
  editingIndex.value = -1
}

function showDetail(index: number) {
  const task = props.tasks[index]
  if (task) {
    emit('detail', index)
  }
}
</script>

<style scoped>
.table-wrapper {
  flex: 1;
  overflow: hidden;
  padding: var(--app-space-2);
  display: flex;
  flex-direction: column;
}
.table-wrapper .el-scrollbar {
  flex: 1;
}
.cell-text {
  cursor: pointer;
  font-size: var(--el-font-size-small);
}
.cell-text:hover {
  color: var(--el-color-primary);
}
.unrecognized-bar {
  padding: 4px 8px;
}
.unrecognized-line {
  font-family: var(--el-font-family);
  font-size: var(--el-font-size-extra-small);
  padding: 1px 0;
}
</style>
