/*
 * @Author: zhengrenfu
 * @Date: 2026-11-04 15:19:46
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 16:45:00
 * @FilePath: \src\composables\useUpdater.ts
 * @Description: 应用更新的检查、确认与安装编排
 */

import { ref, onScopeDispose } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useLogStore } from '@/stores/log.store'
import type { UpdateCheckResult, UpdateProgress, UpdateStatus } from '@/types/update'

/** 转义 HTML：更新说明来自接口或文件名，弹窗按 HTML 渲染前先转义 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * 应用更新流程：读取状态、检查更新、确认后启动安装
 * @returns 更新状态、进度与操作方法
 */
export function useUpdater() {
  const logStore = useLogStore()
  const status = ref<UpdateStatus | null>(null)
  const checking = ref(false)
  const applying = ref(false)
  const progress = ref<UpdateProgress | null>(null)

  /** 读取当前版本与上次检查时间 */
  async function loadStatus(): Promise<void> {
    try {
      status.value = await window.electron.getUpdateStatus()
    } catch (e: any) {
      logStore.addLog('error', `读取更新状态失败: ${e?.message || e}`)
    }
  }

  /**
   * 检查更新
   * @param {boolean} manual 是否手动检查，手动检查时把结果写进日志
   * @returns {Promise<UpdateCheckResult | null>} 检查结果，异常时为 null
   */
  async function runCheck(manual: boolean): Promise<UpdateCheckResult | null> {
    if (checking.value) return null
    checking.value = true
    try {
      const result = await window.electron.checkUpdate()
      await loadStatus()
      if (result.error) {
        logStore.addLog('warning', `检查更新失败: ${result.error}`)
      } else if (manual) {
        logStore.addLog(
          result.hasUpdate ? 'info' : 'success',
          result.hasUpdate ? `发现新版本 ${result.version || ''}` : '当前已是最新版本',
        )
      }
      return result
    } catch (e: any) {
      logStore.addLog('error', `检查更新失败: ${e?.message || e}`)
      return null
    } finally {
      checking.value = false
    }
  }

  /**
   * 弹窗确认后应用更新：复制或下载安装包，校验 MD5 并启动安装程序
   * @param {UpdateCheckResult} result 检查结果
   * @returns {Promise<boolean>} 安装程序是否已启动
   */
  async function offerUpdate(result: UpdateCheckResult): Promise<boolean> {
    if (!result.hasUpdate || applying.value) return false
    const lines = [`发现新版本 ${escapeHtml(result.version || '')}`]
    if (result.notes) lines.push(`更新说明：${escapeHtml(result.notes)}`)
    lines.push('点击「立即更新」后本程序会退出并启动安装程序。')
    try {
      await ElMessageBox.confirm(lines.join('<br>'), '发现新版本', {
        dangerouslyUseHTMLString: true,
        confirmButtonText: '立即更新',
        cancelButtonText: '稍后',
        type: 'info',
      })
    } catch {
      return false
    }

    applying.value = true
    progress.value = null
    try {
      const ret = await window.electron.applyUpdate({
        source: result.source,
        version: result.version,
        fileName: result.fileName,
        filePath: result.filePath,
        url: result.url,
        md5: result.md5,
      })
      if (ret.started) {
        logStore.addLog('info', '安装程序已启动，本程序即将退出')
        return true
      }
      logStore.addLog('error', `更新失败: ${ret.error || '未知错误'}`)
      return false
    } catch (e: any) {
      logStore.addLog('error', `更新失败: ${e?.message || e}`)
      return false
    } finally {
      applying.value = false
    }
  }

  const offProgress = window.electron?.onUpdateProgress?.((p: UpdateProgress) => {
    progress.value = p
  })
  onScopeDispose(() => {
    offProgress?.()
  })

  return { status, checking, applying, progress, loadStatus, runCheck, offerUpdate }
}
