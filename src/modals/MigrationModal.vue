<!--
 * @Author: zhengrenfu
 * @Date: 2026-09-24 09:54:39
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-09-24 09:54:39
 * @FilePath: \src\modals\MigrationModal.vue
 * @Description: 数据迁移对话框：把平铺的历史文件整理成年/月目录
-->
<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('close')"
    title="数据迁移"
    width="520"
    top="5vh"
    :close-on-click-modal="false"
  >
    <div class="migration-body">
      <p class="desc">
        把历史目录里平铺的
        <code>2026-09-24.json</code>
        这类文件按年份和月份归档到
        <code>2026/09/</code>
        子目录，只移动文件，不改文件名也不改内容。
      </p>
      <p class="desc">
        当前档案：<b>{{ profile }}</b>
      </p>
      <el-alert v-if="result" :title="resultText" :type="resultType" :closable="false" show-icon />
    </div>

    <template #footer>
      <el-button plain @click="emit('close')">关闭</el-button>
      <el-button type="primary" :loading="running" @click="handleMigrate">开始迁移</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useLogStore } from '@/stores/log.store'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const logStore = useLogStore()
const profile = ref('')
const running = ref(false)
const result = ref<{ total: number; moved: number; skipped: number; failed: number } | null>(null)

const resultText = computed(() => {
  const r = result.value
  if (!r) return ''
  if (r.total === 0) return '没有需要迁移的文件，历史目录已经是年/月结构'
  return `扫描 ${r.total} 个，迁移 ${r.moved} 个，跳过 ${r.skipped} 个，失败 ${r.failed} 个`
})

// 失败数大于零才算警告，避免部分失败被当成整体成功
const resultType = computed(() => (result.value?.failed ? 'warning' : 'success'))

watch(
  () => props.visible,
  async (v) => {
    if (!v) return
    result.value = null
    try {
      profile.value = await window.electron.profileCurrent()
    } catch (e) {
      logStore.addLog('error', `读取当前用户失败: ${(e as Error).message || e}`)
    }
  },
)

async function handleMigrate() {
  running.value = true
  try {
    result.value = await window.electron.migrateHistoryLayout()
    const r = result.value
    if (r.moved > 0) {
      logStore.addLog('success', `数据迁移完成: 迁移 ${r.moved} 个，跳过 ${r.skipped} 个，失败 ${r.failed} 个`)
    } else {
      logStore.addLog('info', '数据迁移: 没有需要迁移的文件')
    }
  } catch (e) {
    logStore.addLog('error', `数据迁移失败: ${(e as Error).message || e}`)
  } finally {
    running.value = false
  }
}
</script>

<style scoped>
.migration-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.desc {
  margin: 0;
  line-height: 1.6;
  font-size: 13px;
}

.desc code {
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--el-fill-color);
}
</style>
