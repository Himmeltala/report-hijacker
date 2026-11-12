<!--
 * @Author: Himmeltala
 * @Date: 2026-11-08 18:26:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-08 18:26:00
 * @FilePath: \src\views\Settings\components\MailTestPanel.vue
 * @Description: 邮件通知测试面板，用当前 SMTP 配置发送一封测试邮件，便于在设置页直接验证配置
-->
<template>
  <div class="mail-test-panel">
    <el-button type="primary" plain :loading="sending" @click="sendTest">发送测试邮件</el-button>
    <span class="mail-test-tip">用当前 SMTP 配置给上面填写的收件邮箱发一封测试邮件，不受「启用邮件通知」开关影响</span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useLogStore } from '@/stores/log.store'
import { getErrorMessage } from '@/utils/error'

const logStore = useLogStore()
const sending = ref(false)

// 用当前设置里的 SMTP 配置发送测试邮件，失败原因直接提示并写入日志
async function sendTest(): Promise<void> {
  if (sending.value) return
  sending.value = true
  try {
    const res = await window.electron.sendTestMail()
    if (res.success) {
      ElMessage.success('测试邮件已发送，请到收件邮箱查收')
      logStore.addLog('success', '测试邮件已发送')
    } else {
      const reason = res.reason || '未知原因'
      ElMessage.error('测试邮件发送失败: ' + reason)
      logStore.addLog('warning', '测试邮件发送失败: ' + reason)
    }
  } catch (e) {
    const reason = getErrorMessage(e)
    ElMessage.error('测试邮件发送失败: ' + reason)
    logStore.addLog('warning', '测试邮件发送失败: ' + reason)
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.mail-test-panel {
  display: flex;
  align-items: center;
  gap: var(--app-space-3);
  flex-wrap: wrap;
}
.mail-test-tip {
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
}
</style>
