<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14 01:34:58
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-07-14 17:13:58
 * @FilePath: \src\views\HistoryTask\modals\EditTaskModal.vue
 * @Description: 编辑任务弹窗
-->
<template>
  <el-dialog
    :model-value="visible"
    title="编辑任务"
    width="30vw"
    top="2vh"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form v-if="form" ref="formRef" :model="form" label-width="140px">
      <el-form-item label="文本项目">
        <el-input v-model="form.rawProjectName" />
      </el-form-item>
      <el-form-item label="文本标题">
        <el-input v-model="form.rawTitle" type="textarea" :rows="3" />
      </el-form-item>
      <el-form-item label="文本链接">
        <el-input v-model="form.rawUrl" />
      </el-form-item>
      <el-form-item label="文本预估时长">
        <el-input v-model="form.rawScore" style="width: 100%" />
      </el-form-item>
      <el-form-item label="文本处理人">
        <el-input v-model="form.rawHandler" />
      </el-form-item>
      <el-form-item label="执行优先级">
        <el-radio-group v-model="form.serPriority">
          <el-radio value="high">高</el-radio>
          <el-radio value="medium">中</el-radio>
          <el-radio value="low">低</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="日期">
        <input type="date" v-model="form.serDate" class="date-input-native" style="width: 100%" />
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
import type { DatedTask } from '@/types/history'

const props = defineProps<{
  visible: boolean
  task: DatedTask | null
}>()

const emit = defineEmits<{
  close: []
  confirm: [task: DatedTask]
  'update:visible': [value: boolean]
}>()

const form = ref<DatedTask | null>(null)
const formRef = ref()

watch(
  () => props.task,
  (t) => {
    form.value = t ? JSON.parse(JSON.stringify(t)) : null
  },
  { immediate: true },
)

function handleClose() {
  emit('close')
}

function handleConfirm() {
  if (!form.value) return
  emit('confirm', JSON.parse(JSON.stringify(form.value)))
}
</script>

<style scoped>
.date-input-native {
  width: 100%;
  padding: 0 8px;
  height: 24px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--app-radius-sm);
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-regular);
  font-size: 13px;
  outline: none;
}
.date-input-native:focus {
  border-color: var(--el-color-primary);
}
</style>
