/*
 * @Author: zhengrenfu
 * @Date: 2026-07-12 01:19:56
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04 12:14:04
 * @FilePath: \src\stores\settings.store.ts
 * 应用配置 Pinia store — 管理所有持久化设置项

 * @Description: 描述
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppConfig } from '@/types/config'
import { useLogStore } from '@/stores/log.store'

// #region 键名映射

/**
 * AppConfig 属性名 到 持久化键名 映射表
 *
 * 约定：每个设置项的键名由 所属store分类.设置名 组成。
 * 此映射确保前端代码使用简短、自描述的属性名（如 cookie），
 * 而 Electron 持久化使用带分类前缀的键名（如 connection.cookie），
 * 使 settings.json 结构与 settings_schema.json 的分类层级一致。
 *
 * 添加设置项时须在此添加映射，并同步更新 CONFIG_KEYS（SettingsDialog）。
 */
export const SETTING_KEY_MAP: Record<keyof AppConfig, string> = {
  cookie: 'connection.cookie',
  handlerName: 'validation.handlerName',
  boundaryRules: 'validation.boundaryRules',
  boundaryMatchMode: 'validation.boundaryMatchMode',
  taskRegex: 'parsing.taskRegex',
  groupRegex: 'parsing.groupRegex',
  apiBaseUrl: 'connection.apiBaseUrl',
  templatePath: 'export.templatePath',
  commentRules: 'validation.commentRules',
  commentMatchMode: 'validation.commentMatchMode',
  checkRules: 'validation.checkRules',
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
    boundaryRules: [],
    boundaryMatchMode: 'any',
    taskRegex: '',
    apiBaseUrl: '',
    templatePath: '',
    groupRegex: '',
    // 默认值与 settings_schema.json 保持一致（首次运行由 AppSettings 写盘兜底）
    commentRules: [{ enabled: true, label: '代码提交', pattern: '代码提交', isRegex: true }],
    commentMatchMode: 'all',
    aiEnabled: false,
    // 默认值与 settings_schema.json validation.checkRules 保持一致
    checkRules: [
      {
        enabled: true,
        label: '任务标题',
        field: 'subject',
        expected: 'text',
        expectedKey: 'rawTitle',
        compare: 'equals',
      },
      {
        enabled: true,
        label: '项目名称',
        field: '_embedded.project.name',
        expected: 'text',
        expectedKey: 'rawProjectName',
        compare: 'equals',
      },
      {
        enabled: true,
        label: '处理人',
        field: '_embedded.responsible.name',
        expected: 'config',
        expectedKey: 'validation.handlerName',
        compare: 'equals',
      },
      {
        enabled: true,
        label: '所属部门',
        field: 'customField106',
        expected: 'none',
        compare: 'regex-all',
        matchMode: 'all',
        rules: [],
      },
      {
        enabled: true,
        label: '任务状态',
        field: '_embedded.status.name',
        expected: 'none',
        compare: 'list-any',
        values: ['待检查', '已实现'],
      },
      {
        enabled: true,
        label: '自评时长',
        field: 'estimatedTime',
        expected: 'text',
        expectedKey: 'rawScore',
        compare: 'diff-hours',
        tolerance: 3,
      },
      {
        enabled: true,
        label: '自评与预估偏差',
        field: 'estimatedTime',
        expected: 'none',
        compare: 'field-diff',
        compareField: 'customField105',
        tolerance: 3,
      },
      {
        enabled: true,
        label: '预估时长',
        field: 'customField105',
        expected: 'text',
        expectedKey: 'rawScore',
        compare: 'equals',
        skipTypes: ['缺陷'],
      },
      {
        enabled: true,
        label: '前提条件',
        field: 'description.raw',
        expected: 'none',
        compare: 'regex-any',
        matchMode: 'any',
        skipTypes: ['缺陷'],
        rules: [
          {
            enabled: true,
            label: '前提条件',
            pattern: '前提条件[：:]\\s*\\S',
            isRegex: true,
          },
        ],
      },
      {
        enabled: true,
        label: '成果形式',
        field: 'description.raw',
        expected: 'none',
        compare: 'regex-any',
        matchMode: 'any',
        skipTypes: ['缺陷'],
        rules: [
          {
            enabled: true,
            label: '成果形式',
            pattern: '成果形式[：:]\\s*\\S',
            isRegex: true,
          },
        ],
      },
      {
        enabled: true,
        label: '自评时长下限',
        field: 'estimatedTime',
        expected: 'none' as const,
        compare: 'gte' as const,
        expectedKey: '0.5',
      },
      {
        enabled: true,
        label: '预估时长下限',
        field: 'customField105',
        expected: 'none' as const,
        compare: 'gte' as const,
        expectedKey: '0.5',
      },
      {
        enabled: true,
        label: '流程图',
        field: 'description.raw',
        expected: 'none',
        compare: 'regex-any',
        matchMode: 'any',
        skipTypes: ['缺陷'],
        rules: [
          {
            enabled: true,
            label: '包含图片',
            pattern: '<img\\b|\\.(png|jpg|jpeg|gif|webp|bmp)\\b|/api/v3/attachments/\\d+/content',
            isRegex: true,
          },
        ],
      },
    ],
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
