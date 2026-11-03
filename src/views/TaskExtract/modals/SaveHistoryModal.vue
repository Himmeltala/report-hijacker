<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14 21:36:19
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04 09:11:39
 * @FilePath: \src\views\TaskExtract\modals\SaveHistoryModal.vue
 * @Description: 保存历史弹窗，日期选择器内置今天/昨天/明天快捷选项
-->

<template>
  <el-dialog
    :model-value="visible"
    title="保存到历史"
    width="380px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', false)"
  >
    <div class="save-info">
      <el-icon size="20" color="var(--el-color-primary)"><Collection /></el-icon>
      <span
        >共 <strong>{{ taskCount }}</strong> 条任务将保存到历史记录</span
      >
    </div>

    <el-form label-width="70px" class="save-form">
      <el-form-item label="保存日期">
        <el-date-picker
          v-model="saveDate"
          type="date"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          :shortcuts="dateShortcuts"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="handleConfirm" :disabled="!saveDate">确认保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Collection } from '@element-plus/icons-vue'

const props = defineProps<{
  visible: boolean
  taskCount: number
  defaultDate: string
}>()

const emit = defineEmits<{
  close: []
  confirm: [date: string]
  'update:visible': [value: boolean]
}>()

const saveDate = ref(props.defaultDate)

/**
 * 日期选择器快捷选项：今天、昨天、明天
 * 使用函数形式确保每次点击时重新计算日期
 */
const dateShortcuts = [
  {
    text: '今天',
    value: () => {
      const d = new Date()
      return d
    },
  },
  {
    text: '昨天',
    value: () => {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      return d
    },
  },
  {
    text: '明天',
    value: () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      return d
    },
  },
]

function handleConfirm() {
  if (saveDate.value) {
    emit('confirm', saveDate.value)
  }
}
</script>

<style scoped>
.save-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0 12px;
  font-size: var(--el-font-size-base);
}
.save-info strong {
  color: var(--el-color-primary);
}
.save-form {
  padding-top: 4px;
}
</style>
