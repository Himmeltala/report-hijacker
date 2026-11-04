/*
 * @Author: zhengrenfu
 * @Date: 2026-08-04
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 14:21:53
 * @FilePath: \electron\services\settingsService.ts
 * @Description: 设置服务：schema 驱动的默认值构建、JSON 持久化及设置 IPC
 */

import { ipcMain, dialog, BrowserWindow } from 'electron'
import { dirname, join } from 'path'
import { existsSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'fs'
import { readJsonFile, listJsonBasenames } from '@electron/utils'

// #region 常量

/** 导出设置时 Cookie 的脱敏占位值，导入时识别该值并跳过，保留当前 Cookie */
const COOKIE_MASK = '******'

/** 历史版本的任务审查默认提示词：设置里仍是旧默认值时升级为当前默认，用户自己改过的不动 */
const LEGACY_TASK_REVIEW_PROMPTS = [
  `你是任务完成情况审查员。根据以下任务信息审查任务是否已按要求完成，只输出审查结论文本。

任务标题：{title}
任务状态：{status}
任务类型：{type}
任务描述：
{description}

评论区内容：
{comments}

要求：
1. 只输出审查结论，不超过 30 字，不要输出其他任何内容。
2. 发现问题时直接指出问题本身，例如：代码未提交、评论未说明完成情况、缺少成果形式。
3. 未发现明显问题时输出：审查通过。`,
  `你是任务完成情况审查员。审查下面这条任务是否已按要求完成，只输出审查结论。

任务信息：
任务标题：{title}
任务状态：{status}
任务类型：{type}
任务日期：{date}
今天日期：{today}
处理人（任务）：{responsible}
处理人（设置预期）：{expectedHandler}
所属部门（任务）：{department}
所属部门（设置预期）：{expectedDepartment}
自评时长（小时）：{selfHours}
预估时长（小时）：{estimateHours}

任务描述：
{description}

评论区内容：
{comments}

审查标准：
一、任务描述是否写清四部分
1. 是什么：前提条件、成果形式、边界三项都要有。缺哪项就指出，并依据「干什么」给出补充建议。
2. 干什么：要做的事是否表达清楚；模棱两可或与标题不符时指出。
3. 怎么检查：检查内容是否齐全；按任务内容补充应该覆盖的测试用例建议。
4. 怎么做：是否包含流程图与做法步骤；从描述里提取关键步骤，缺失时给出建议。
二、任务属性
5. 处理人是否与设置中的处理人一致，所属部门是否与设置中的所属部门一致；设置中的处理人或所属部门为空时跳过对应比对。
6. 自评时长不得超过预估时长 1.5 小时，超出时报问题（自评减预估大于 1.5 小时才算异常）。
7. 任务日期是否在今天范围内；任务日期为空时跳过此项。
三、评论区
8. 是否说明完成情况，是否有代码提交记录与成果物（截图、文档、链接等）提交信息，缺失时指出。

输出要求：
1. 只输出审查结论，可以分条列出，不再限制字数。
2. 未发现明显问题时输出「审查通过」。
3. 发现问题时逐条列出问题，并对可补充内容给出具体建议，例如补充前提条件、成果形式、边界、测试用例、做法步骤。
4. 任务类型为缺陷时跳过「一」的描述完整性审查，只审查任务属性与评论区。`,
]

// #endregion

// #region AppSettings 类

/**
 * 设置管理类：按 schema 构建默认值，支持点号键名读写与批量写入
 */
export class AppSettings {
  private path: string
  private schemaPath: string
  private data: Record<string, any> = {}
  private schemaDefaults: Record<string, any> = {}

  constructor(settingsPath: string, schemaPath: string) {
    this.path = settingsPath
    this.schemaPath = schemaPath
    this.buildDefaults()
    this.load()
  }

  // #region 私有方法

  private buildDefaults(): void {
    this.data = {}
    this.schemaDefaults = {}
    if (!existsSync(this.schemaPath)) return
    try {
      const schema = JSON.parse(readFileSync(this.schemaPath, 'utf-8'))
      for (const cat of schema) {
        for (const group of cat.groups || []) {
          for (const setting of group.settings || []) {
            if (setting.default !== undefined && setting.default !== null) {
              this.schemaDefaults[setting.key] = setting.default
              this.setNested(setting.key, setting.default)
            }
          }
        }
      }
    } catch (e) {
      console.error('[Settings] 构建默认值失败:', e)
    }
  }

  /** 按点号路径写入嵌套值 */
  private setNested(key: string, value: any): void {
    const parts = key.split('.')
    let d = this.data
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in d) || typeof d[parts[i]] !== 'object') {
        d[parts[i]] = {}
      }
      d = d[parts[i]]
    }
    d[parts[parts.length - 1]] = value
  }

  private deepMerge(target: any, source: any): void {
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') target[key] = {}
        this.deepMerge(target[key], source[key])
      } else {
        target[key] = source[key]
      }
    }
  }

  private load(): void {
    if (!existsSync(this.path)) {
      this.save()
      return
    }
    try {
      const loaded = JSON.parse(readFileSync(this.path, 'utf-8'))
      this.deepMerge(this.data, loaded)
      this.upgradeLegacyTaskReviewPrompt()
    } catch (e) {
      console.error('[Settings] 读取设置文件失败:', e)
    }
  }

  /** 旧版任务审查默认提示词升级：只替换仍是旧默认值的配置，用户改过的不动 */
  private upgradeLegacyTaskReviewPrompt(): void {
    const current = this.data?.ai?.taskReview?.prompt
    const next = this.schemaDefaults['ai.taskReview.prompt']
    if (typeof current !== 'string' || typeof next !== 'string') return
    if (!LEGACY_TASK_REVIEW_PROMPTS.includes(current.trim())) return
    this.data.ai.taskReview.prompt = next
    this.save()
  }

  // #endregion

  // #region 公共方法

  save(): void {
    mkdirSync(dirname(this.path), { recursive: true })
    writeFileSync(this.path, JSON.stringify(this.data, null, 2), 'utf-8')
  }

  /**
   * 按点号路径读取值
   * @param {string} key 设置键名
   * @param {any} defaultVal 默认值
   * @returns {any} 设置值
   */
  get(key: string, defaultVal?: any): any {
    const parts = key.split('.')
    let d: any = this.data
    for (const part of parts) {
      if (d && typeof d === 'object' && part in d) {
        d = d[part]
      } else {
        return defaultVal
      }
    }
    return d
  }

  /**
   * 按点号路径写入值并持久化
   * @param {string} key 设置键名
   * @param {any} value 设置值
   */
  set(key: string, value: any): void {
    this.setNested(key, value)
    this.save()
  }

  /**
   * 批量设置多个键值对，仅写入磁盘一次
   * @param {Array<[string, any]>} entries 键值对列表
   */
  setBatch(entries: Array<[string, any]>): void {
    for (const [key, value] of entries) {
      this.setNested(key, value)
    }
    this.save()
  }

  exportData(): Record<string, any> {
    return this.data
  }

  getSchemaPath(): string {
    return this.schemaPath
  }

  // #endregion
}

// #endregion

// #region IPC 注册

/**
 * 注册设置与通用存储 IPC
 * @param {object} deps 依赖项
 * @param {() => AppSettings} deps.getSettings 获取当前设置实例（档案切换后可能被替换）
 * @param {BrowserWindow | null} deps.mainWindow 主窗口
 * @param {() => string} deps.getStoreDir 获取通用存储目录
 * @param {() => void} deps.onBackupSettingChanged 备份设置变更回调
 */
export function setupSettingsIpc(deps: {
  getSettings: () => AppSettings
  mainWindow: BrowserWindow | null
  getStoreDir: () => string
  onBackupSettingChanged: () => void
  /** 更新设置变更后的回调，用于重建更新检查定时器 */
  onUpdateSettingChanged?: () => void
}): void {
  const { getSettings, mainWindow, getStoreDir, onBackupSettingChanged, onUpdateSettingChanged } = deps

  // #region 设置读写

  ipcMain.handle('settings:get', (_e, key) => {
    // undefined 在 IPC 序列化中会丢失字段，统一转为 null 保证调用方行为一致
    return getSettings().get(key) ?? null
  })
  // 一次性返回全部设置（点号键名扁平化），渲染端启动时避免逐个键往返
  ipcMain.handle('settings:getAll', () => {
    const flat: Record<string, any> = {}
    const walk = (obj: Record<string, any>, prefix: string) => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          walk(value, fullKey)
        } else {
          flat[fullKey] = value
        }
      }
    }
    walk(getSettings().exportData(), '')
    return flat
  })
  ipcMain.handle('settings:set', (_e, key, value) => {
    getSettings().set(key, value)
    if (key === 'appearance.theme' || key === 'theme') {
      mainWindow?.webContents.send('event:themeChanged', value)
    }
    if (key.startsWith('history.backup')) {
      onBackupSettingChanged()
    }
    // 自动同步设置变更后通知渲染进程重启定时器，无需重启或重新进页才能生效
    if (key.startsWith('history.autoSync')) {
      mainWindow?.webContents.send('event:autoSyncSettingsChanged')
    }
    // 更新设置变更后立即重建更新检查定时器
    if (key.startsWith('update.')) {
      onUpdateSettingChanged?.()
    }
  })
  ipcMain.handle('settings:getSchema', () => {
    const schemaPath = getSettings().getSchemaPath()
    if (schemaPath && existsSync(schemaPath)) {
      return readJsonFile(schemaPath, [])
    }
    return []
  })

  // #endregion

  // #region 设置导入导出

  ipcMain.handle('settings:export', async () => {
    const filePath = await dialog.showSaveDialog({
      title: '导出设置',
      defaultPath: `settings-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (filePath.canceled || !filePath.filePath) return { success: false }
    // 深拷贝后脱敏，避免掩码值写回当前配置被持久化
    const data = JSON.parse(JSON.stringify(getSettings().exportData()))
    // 导出时对 Cookie 脱敏，避免设置文件泄露平台账号凭证
    if (data.connection && typeof data.connection === 'object' && data.connection.cookie) {
      data.connection = { ...data.connection, cookie: COOKIE_MASK }
    }
    // AI 密钥同样脱敏，避免大模型密钥随设置文件泄露
    if (data.ai && typeof data.ai === 'object' && data.ai.apiKey) {
      data.ai = { ...data.ai, apiKey: COOKIE_MASK }
    }
    writeFileSync(filePath.filePath, JSON.stringify(data, null, 2), 'utf-8')
    return { success: true, filePath: filePath.filePath }
  })
  ipcMain.handle('settings:import', async () => {
    const filePath = await dialog.showOpenDialog({
      title: '导入设置',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (filePath.canceled || !filePath.filePaths?.[0]) return null
    const raw = readFileSync(filePath.filePaths[0], 'utf-8')
    let data: any
    try {
      data = JSON.parse(raw)
    } catch {
      throw new Error('设置文件不是有效的 JSON')
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('无效的设置文件')
    // 导入时跳过导出的脱敏 AI 密钥，保留当前密钥
    if (data.ai && typeof data.ai === 'object' && data.ai.apiKey === COOKIE_MASK) {
      data.ai = { ...data.ai, apiKey: getSettings().get('ai.apiKey', '') }
    }
    // 仅导入对象类型的顶层设置，避免损坏结构污染当前配置
    const entries = (Object.entries(data) as Array<[string, any]>).filter(
      ([key, value]) =>
        key !== 'schemaPath' &&
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        // 跳过导出的脱敏 Cookie，保留当前登录态
        !(key === 'connection' && value.cookie === COOKIE_MASK),
    )
    getSettings().setBatch(entries)
    // 备份配置变更后需重启备份定时器，导入的配置才能立即生效
    if (entries.some(([key]) => key.startsWith('history.backup'))) {
      onBackupSettingChanged()
    }
    // 自动同步设置变更后通知渲染进程重启定时器
    if (entries.some(([key]) => key.startsWith('history.autoSync'))) {
      mainWindow?.webContents.send('event:autoSyncSettingsChanged')
    }
    // 主题配置变更后通知渲染进程刷新
    if (data.appearance && typeof data.appearance === 'object' && data.appearance.theme !== undefined) {
      mainWindow?.webContents.send('event:themeChanged', data.appearance.theme)
    }
    return { success: true }
  })

  // #endregion

  // #region 通用数据存储

  ipcMain.handle('store:get', (_e, key: string) => {
    const filePath = join(getStoreDir(), `${key}.json`)
    return readJsonFile(filePath, null)
  })
  ipcMain.handle('store:set', (_e, key: string, value: any) => {
    if (value === undefined) throw new Error('store:set 不支持 undefined 值')
    const filePath = join(getStoreDir(), `${key}.json`)
    writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8')
  })
  ipcMain.handle('store:delete', (_e, key: string) => {
    const filePath = join(getStoreDir(), `${key}.json`)
    if (existsSync(filePath)) rmSync(filePath)
  })
  ipcMain.handle('store:keys', () => {
    return listJsonBasenames(getStoreDir())
  })

  // #endregion
}

// #endregion
