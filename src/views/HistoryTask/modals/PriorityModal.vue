<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-08 01:39:21
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-08 01:39:21
 * @FilePath: \src\views\HistoryTask\modals\PriorityModal.vue
 * @Description: 执行优先级标记弹窗
-->
<template>
  <el-dialog
    :model-value="visible"
    title="执行优先级"
    width="360px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form label-width="80px">
      <el-form-item label="优先级">
        <el-radio-group v-model="formData.priority">
          <el-radio value="high">高</el-radio>
          <el-radio value="medium">中</el-radio>
          <el-radio value="low">低</el-radio>
          <el-radio value="none">无</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleConfirm">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { TaskPriority, TaskPriorityForm } from '@/types/history'

// 弹窗内用 none 表示未设置，确认时再转回 null，便于绑定 radio
type PriorityOption = TaskPriority | 'none'

const props = defineProps<{
  visible: boolean
  form: TaskPriorityForm | null
}>()

const emit = defineEmits<{
  close: []
  confirm: [form: TaskPriorityForm]
  'update:visible': [value: boolean]
}>()

const formData = ref<{ priority: PriorityOption }>({ priority: 'none' })

watch(
  () => props.form,
  (f) => {
    formData.value = { priority: f?.priority ?? 'none' }
  },
  { immediate: true },
)

function handleClose() {
  emit('close')
}

function handleConfirm() {
  emit('confirm', { priority: formData.value.priority === 'none' ? null : formData.value.priority })
}
</script>
