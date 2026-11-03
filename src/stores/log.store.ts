/*
 * @Author: zhengrenfu
 * @Date: 2026-07-14 23:25:30
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-07-14 12:14:04
 * @FilePath: \..\\src\\stores\\log.store.ts
 * @Description: 描述
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LogEntry } from '@/types/log'

// 日志面板折叠状态的 localStorage 键名
const LOG_PANEL_KEY = 'log_panel_collapsed'

export const useLogStore = defineStore('log', () => {
  // #region 状态

  const logs = ref<LogEntry[]>([])
  // 面板折叠状态持久化到 localStorage，重启后保持上次状态
  const panelVisible = ref(localStorage.getItem(LOG_PANEL_KEY) !== 'collapsed')
  const panelHeight = ref(200)
  const maxLines = ref(500)
  const filterTypes = ref(new Set<string>(['info', 'success', 'warning', 'error']))

  // #endregion

  // #region 计算属性

  const filteredLogs = computed(() => {
    return logs.value.filter((l) => filterTypes.value.has(l.type))
  })

  // #endregion

  // #region 日志操作

  function addLog(type: LogEntry['type'], message: string) {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    logs.value.push({ type, message, time })
    if (logs.value.length > maxLines.value) {
      logs.value = logs.value.slice(-maxLines.value)
    }
  }

  function clearLogs() {
    logs.value = []
  }

  // #endregion

  // #region 面板操作

  function togglePanel() {
    panelVisible.value = !panelVisible.value
    // 折叠状态持久化，重启应用后保持
    localStorage.setItem(LOG_PANEL_KEY, panelVisible.value ? 'expanded' : 'collapsed')
  }

  function setPanelHeight(h: number) {
    panelHeight.value = h
  }

  function toggleFilterType(type: string) {
    const s = new Set(filterTypes.value)
    if (s.has(type)) s.delete(type)
    else s.add(type)
    if (s.size === 0) {
      ;['info', 'success', 'warning', 'error'].forEach((t) => s.add(t))
    }
    filterTypes.value = s
  }

  // #endregion

  // #region 设置持久化

  async function saveSetting(key: string, value: any) {
    try {
      await window.electron?.setSetting?.(`appearance.${key}`, value)
    } catch {
      // 忽略
    }
  }

  async function loadSettings() {
    try {
      const h = await window.electron?.getSetting?.('appearance.logPanelHeight')
      if (h) panelHeight.value = Number(h) || 200
      const m = await window.electron?.getSetting?.('appearance.logMaxLines')
      if (m) maxLines.value = Number(m) || 500
    } catch {
      // 忽略
    }
  }

  // #endregion

  // #region 返回值

  return {
    logs,
    panelVisible,
    panelHeight,
    maxLines,
    filterTypes,
    filteredLogs,
    addLog,
    clearLogs,
    togglePanel,
    setPanelHeight,
    toggleFilterType,
    saveSetting,
    loadSettings,
  }

  // #endregion
})
