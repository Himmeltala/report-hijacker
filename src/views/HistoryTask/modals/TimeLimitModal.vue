<!--
 * @Author: zhengrenfu
 * @Date: 2026-10-22 09:30:00
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-10-22 09:30:00
 * @FilePath: \src\views\HistoryTask\modals\TimeLimitModal.vue
 * @Description: 限时任务标记弹窗
-->
<template>
  <el-dialog
    :model-value="visible"
    title="限时任务"
    width="360px"
    top="2vh"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form label-width="80px">
      <el-form-item label="限时任务">
        <el-radio-group v-model="formData.timeLimit">
          <el-radio value="today">今日</el-radio>
          <el-radio value="temp">临时</el-radio>
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

interface TimeLimitForm {
  timeLimit: 'today' | 'temp' | null
}

// 弹窗内用 none 表示未设置，确认时再转回 null，便于 radio 绑定
type TimeLimitOption = 'today' | 'temp' | 'none'

const props = defineProps<{
  visible: boolean
  form: TimeLimitForm | null
}>()

const emit = defineEmits<{
  close: []
  confirm: [form: TimeLimitForm]
  'update:visible': [value: boolean]
}>()

const formData = ref<{ timeLimit: TimeLimitOption }>({ timeLimit: 'none' })

watch(
  () => props.form,
  (f) => {
    formData.value = { timeLimit: f?.timeLimit ?? 'none' }
  },
  { immediate: true },
)

function handleClose() {
  emit('close')
}

function handleConfirm() {
  emit('confirm', { timeLimit: formData.value.timeLimit === 'none' ? null : formData.value.timeLimit })
}
</script>
