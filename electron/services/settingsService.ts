/*
 * @Author: zhengrenfu
 * @Date: 2026-08-04
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04
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

// #endregion

// #region AppSettings 类

/**
 * 设置管理类：按 schema 构建默认值，支持点号键名读写与批量写入
 */
export class AppSettings {
  private path: string
  private schemaPath: string
  private data: Record<string, any> = {}

  constructor(settingsPath: string, schemaPath: string) {
    this.path = settingsPath
    this.schemaPath = schemaPath
    this.buildDefaults()
    this.load()
  }

  // #region 私有方法

  private buildDefaults(): void {
    this.data = {}
    if (!existsSync(this.schemaPath)) return
    try {
      const schema = JSON.parse(readFileSync(this.schemaPath, 'utf-8'))
      for (const cat of schema) {
        for (const group of cat.groups || []) {
          for (const setting of group.settings || []) {
            if (setting.default !== undefined && setting.default !== null) {
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
    } catch (e) {
      console.error('[Settings] 读取设置文件失败:', e)
    }
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
}): void {
  const { getSettings, mainWindow, getStoreDir, onBackupSettingChanged } = deps

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
