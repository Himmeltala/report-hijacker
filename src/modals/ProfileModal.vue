<!--
 * @Author: zhengrenfu
 * @Date: 2026-08-01 01:34:55
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-01 12:14:04
 * @FilePath: \src\modals\ProfileModal.vue
 * @Description: 用户档案管理对话框
-->
<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('close')"
    title="管理用户"
    width="480"
    :close-on-click-modal="false"
  >
    <div class="profile-list">
      <div v-for="p in profiles" :key="p" class="profile-row">
        <div class="profile-row-left">
          <el-icon><UserFilled /></el-icon>
          <template v-if="editing === p">
            <el-input
              v-model="editValue"
              class="edit-input"
              @keyup.enter="confirmRename(p)"
              @keyup.esc="cancelEdit"
              @blur="confirmRename(p)"
            />
          </template>
          <template v-else>
            <span class="profile-row-name" @dblclick="startEdit(p)">{{ p }}</span>
          </template>
          <el-tag v-if="p === current" type="success">当前</el-tag>
        </div>
        <div class="profile-row-actions">
          <el-button v-if="p !== current && profiles.length > 1" type="danger" plain @click="handleDelete(p)">
            删除
          </el-button>
        </div>
      </div>
    </div>

    <div class="profile-add">
      <el-input v-model="newName" placeholder="输入新用户名" @keyup.enter="handleAdd" />
      <el-button type="primary" plain :disabled="!newName.trim()" @click="handleAdd"> 添加 </el-button>
    </div>

    <template #footer>
      <el-button plain @click="emit('close')">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { UserFilled } from '@element-plus/icons-vue'
import { useLogStore } from '@/stores/log.store'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const logStore = useLogStore()
const profiles = ref<string[]>([])
const current = ref('')
const newName = ref('')
const editing = ref('')
const editValue = ref('')

watch(
  () => props.visible,
  async (v) => {
    if (!v) return
    await refresh()
    newName.value = ''
  },
)

async function refresh() {
  try {
    current.value = await window.electron.profileCurrent()
    profiles.value = await window.electron.profileList()
  } catch (e) {
    logStore.addLog('error', `加载用户列表失败: ${(e as Error).message || e}`)
  }
}

async function handleAdd() {
  const name = newName.value.trim()
  if (!name) return
  try {
    profiles.value = await window.electron.profileAdd(name)
    newName.value = ''
  } catch (e) {
    logStore.addLog('error', `添加用户失败: ${(e as Error).message || e}`)
  }
}

function startEdit(name: string) {
  editing.value = name
  editValue.value = name
}

function cancelEdit() {
  editing.value = ''
  editValue.value = ''
}

// 重命名进行中标志，防止 Enter 与 blur 双触发重复提交
let renaming = false

async function confirmRename(oldName: string) {
  if (renaming) return
  renaming = true
  try {
    const val = editValue.value.trim()
    if (!val || val === oldName) {
      cancelEdit()
      return
    }
    try {
      profiles.value = await window.electron.profileRename(oldName, val)
      current.value = await window.electron.profileCurrent()
    } catch (e) {
      logStore.addLog('error', `重命名失败: ${(e as Error).message || e}`)
    }
    cancelEdit()
  } finally {
    renaming = false
  }
}

async function handleDelete(name: string) {
  if (profiles.value.length <= 1) return
  try {
    profiles.value = await window.electron.profileDelete(name)
    current.value = await window.electron.profileCurrent()
  } catch (e) {
    logStore.addLog('error', `删除用户失败: ${(e as Error).message || e}`)
  }
}
</script>

<style scoped>
.profile-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}
.profile-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: var(--app-radius-sm);
  border: 1px solid var(--el-border-color-lighter);
}
.profile-row-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.profile-row-name {
  font-size: 14px;
  font-weight: 500;
}
.profile-add {
  display: flex;
  gap: 8px;
}
.profile-add .el-input {
  flex: 1;
}
.edit-input {
  max-width: 200px;
}
.profile-row-actions {
  flex-shrink: 0;
}
</style>
