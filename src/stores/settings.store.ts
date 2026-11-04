/*
 * @Author: zhengrenfu
 * @Date: 2026-07-12 01:19:56
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 14:21:53
 * @FilePath: \src\stores\settings.store.ts
 * 应用配置 Pinia store — 管理所有持久化设置项

 * @Description: 描述
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppConfig } from '@/types/config'
import { useLogStore } from '@/stores/log.store'

// #region 键名映射

/** AppConfig 属性名到持久化键名的映射表；键名由 store 分类.设置名 组成，使 settings.json 与 settings_schema.json 的分类层级一致 */
export const SETTING_KEY_MAP: Record<keyof AppConfig, string> = {
  cookie: 'connection.cookie',
  handlerName: 'validation.handlerName',
  departmentName: 'validation.departmentName',
  taskRegex: 'parsing.taskRegex',
  groupRegex: 'parsing.groupRegex',
  apiBaseUrl: 'connection.apiBaseUrl',
  templatePath: 'export.templatePath',
  aiEnabled: 'ai.enabled',
}

// 反向映射：持久化键名 到 AppConfig 属性名
export const SETTING_KEY_MAP_REVERSE: Record<string, keyof AppConfig> = {}
for (const [k, v] of Object.entries(SETTING_KEY_MAP)) {
  SETTING_KEY_MAP_REVERSE[v] = k as keyof AppConfig
}

// #endregion

// #region Store 定义

export const useSettingsStore = defineStore('settings', () => {
  // #region 状态

  const logStore = useLogStore()
  const config = ref<AppConfig>({
    cookie: '',
    handlerName: '',
    departmentName: '',
    taskRegex: '',
    apiBaseUrl: '',
    templatePath: '',
    groupRegex: '',
    aiEnabled: false,
  })

  // #endregion

  // #region 操作方法

  function updateConfig(partial: Partial<AppConfig>) {
    config.value = { ...config.value, ...partial }
    for (const [key, value] of Object.entries(partial)) {
      const settingKey = (SETTING_KEY_MAP as any)[key] || key
      // 深拷贝避免 Vue reactive Proxy 导致 IPC 序列化失败
      const cloned = JSON.parse(JSON.stringify(value))
      window.electron?.setSetting?.(settingKey, cloned).catch((e: any) => {
        logStore.addLog('error', `设置持久化失败 ${settingKey}: ${e?.message || e}`)
      })
    }
  }

  async function loadConfig() {
    try {
      // 一次 IPC 取回全部设置，避免启动阶段逐个键往返阻塞挂载
      const all = await window.electron?.getSettingsAll?.()
      if (!all) return
      for (const [configKey, settingKey] of Object.entries(SETTING_KEY_MAP)) {
        const val = all[settingKey]
        if (val !== undefined && val !== null) {
          ;(config.value as any)[configKey] = val
        }
      }
    } catch {
      // 开发模式或无 IPC
    }
  }

  // #endregion

  // #region 返回值

  return { config, updateConfig, loadConfig }

  // #endregion
})

// #endregion
