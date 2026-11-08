<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-30 01:36:05
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-07-30 01:36:05
 * @FilePath: \src\views\HistoryTask\modals\PostponeModal.vue
 * @Description: 延期标记弹窗
-->
<template>
  <el-dialog
    :model-value="visible"
    title="执行延期标记"
    width="400px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form label-width="100px">
      <el-form-item label="标记执行延期">
        <el-switch v-model="formData.postponed" active-text="是" inactive-text="否" />
      </el-form-item>
      <el-form-item label="执行延期原因">
        <el-input
          v-model="formData.postponedReason"
          type="textarea"
          :rows="4"
          placeholder="请输入执行延期原因（可选）"
          :disabled="!formData.postponed"
        />
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
import type { PostponeForm } from '@/types/history'

const props = defineProps<{
  visible: boolean
  form: PostponeForm | null
}>()

const emit = defineEmits<{
  close: []
  confirm: [form: PostponeForm]
  'update:visible': [value: boolean]
}>()

const formData = ref<PostponeForm>({ postponed: false, postponedReason: '' })

watch(
  () => props.form,
  (f) => {
    formData.value = f ? { ...f } : { postponed: false, postponedReason: '' }
  },
  { immediate: true },
)

function handleClose() {
  emit('close')
}

function handleConfirm() {
  emit('confirm', { ...formData.value })
}
</script>
