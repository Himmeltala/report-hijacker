/*
 * @Author: zhengrenfu
 * @Date: 2026-07-15 09:54:03
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-08 18:02:00
 * @FilePath: \electron\main.ts
 * @Description: 主进程入口：窗口、档案激活与各服务装配
 */
import { app, BrowserWindow, Menu, shell, dialog } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { resolveFirstExisting, sendToWindow } from '@electron/utils'
import { createApiClient } from '@electron/services/apiClient'
import { AppSettings, setupSettingsIpc } from '@electron/services/settingsService'
import { setupFileIpc } from '@electron/services/fileService'
import { setupStoreIpc } from '@electron/services/storeService'
import {
  initProfileSystem,
  getProfileDir,
  getProfileSettingsPath,
  setupProfileIpc,
} from '@electron/services/profileService'
import { setupOpenProjectIpc } from '@electron/services/openProjectService'
import { setupAiChatIpc } from '@electron/services/aiChatService'
import { setupAiUsageIpc } from '@electron/services/aiUsageService'
import { setupSysNotificationIpc } from '@electron/services/notificationWindowsService'
import { setupMailNotificationIpc } from '@electron/services/notificationMailService'
import { setupExcelIpc } from '@electron/services/excelService'
import { setupHistoryIpc } from '@electron/services/historyService'
import { setupUpdateService } from '@electron/services/updateService'
import { setupBackupSchedule } from '@schedules/main/backupSchedule'
import { setupUpdateSchedule } from '@schedules/main/updateSchedule'

// 窗口标题与任务栏用中文；存储路径由 package.json 的 productName 决定，保持英文
const APP_TITLE = '日报工具'
let mainWindow: BrowserWindow | null = null

let activeProfile = ''
let schemaPathForReinit = ''
let settings: AppSettings

// 备份与更新检查定时器的重建入口，设置变更与切换档案后调用
let restartBackupSchedule: () => void = () => {}
let restartUpdateScheduler: () => void = () => {}

// #region 数据目录
// 获取当前激活档案的存储目录
function getStoreDir(): string {
  const dir = join(getProfileDir(activeProfile), 'store')
  mkdirSync(dir, { recursive: true })
  return dir
}

// 获取当前激活档案的历史目录
function getHistoryDir(): string {
  const dir = join(getProfileDir(activeProfile), 'history')
  mkdirSync(dir, { recursive: true })
  return dir
}
// #endregion

// #region 窗口
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 500,
    title: APP_TITLE,
    show: false,
    webPreferences: {
      // preload 以 .cjs 输出，避免被 package.json 的 type: module 当作 ESM 加载
      preload: join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  const isDev = !!process.env.VITE_DEV_SERVER_URL
  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(import.meta.dirname, '../dist/index.html'))
  }

  // 拦截外部链接，用系统默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (_e, url) => {
    // 仅放行本地文件与开发服务器的精确主机名，其余导航一律交给系统浏览器
    let isLocalDev = false
    try {
      isLocalDev = new URL(url).hostname === 'localhost'
    } catch {
      isLocalDev = false
    }
    const isDev = !!process.env.VITE_DEV_SERVER_URL
    if (!url.startsWith('file://') && !(isDev && isLocalDev)) {
      _e.preventDefault()
      shell.openExternal(url)
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}
// #endregion

// #region 档案激活
// 激活指定档案：重建 settings 实例、重启备份定时器、通知渲染进程
function activateProfile(name: string): void {
  activeProfile = name
  settings = new AppSettings(getProfileSettingsPath(name), schemaPathForReinit)
  restartBackupSchedule()
  restartUpdateScheduler()
  sendToWindow(() => mainWindow, 'profile:switched', name)
}
// #endregion

// #region IPC 装配
function setupIpcHandlers(): void {
  const api = createApiClient(() => settings.get('connection.apiBaseUrl', 'https://xmgl.cdrunnet.com'))

  setupUpdateService({ getSettings: () => settings, getWindow: () => mainWindow })
  restartUpdateScheduler = setupUpdateSchedule({
    getSettings: () => settings,
    getWindow: () => mainWindow,
  }).restart
  restartBackupSchedule = setupBackupSchedule({
    getSettings: () => settings,
    getHistoryDir,
    getStoreDir,
    getWindow: () => mainWindow,
  }).restart

  setupSettingsIpc({
    getSettings: () => settings,
    getWindow: () => mainWindow,
    onBackupSettingChanged: () => restartBackupSchedule(),
    onUpdateSettingChanged: () => restartUpdateScheduler(),
  })
  setupStoreIpc({ getStoreDir })
  setupFileIpc({ getWindow: () => mainWindow })
  setupOpenProjectIpc(api)
  setupAiChatIpc({ getSettings: () => settings, getStoreDir })
  setupAiUsageIpc({ getStoreDir })
  setupSysNotificationIpc(() => mainWindow)
  setupMailNotificationIpc({ getSettings: () => settings })
  setupExcelIpc(api)
  setupHistoryIpc({
    api,
    getSettings: () => settings,
    getHistoryDir,
    getStoreDir,
    getWindow: () => mainWindow,
  })
  setupProfileIpc({
    getActiveProfile: () => activeProfile,
    onActivate: activateProfile,
  })
}
// #endregion

// Linux 兼容：禁用 GPU 硬件加速（解决 VMware 虚拟机 GPU 初始化失败问题）
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-gpu-compositing')
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

app
  .whenReady()
  .then(() => {
    // Windows 系统通知要求与 electron-builder.yml 的 appId 一致，不一致则通知不显示
    app.setAppUserModelId('com.himmeltala.reporthijacker')

    activeProfile = initProfileSystem()

    schemaPathForReinit = resolveFirstExisting([
      join(app.getAppPath(), 'assets', 'settings', 'settings_schema.json'),
      join(app.getAppPath(), '..', 'assets', 'settings', 'settings_schema.json'),
      join(import.meta.dirname, '..', 'assets', 'settings', 'settings_schema.json'),
    ])

    settings = new AppSettings(getProfileSettingsPath(activeProfile), schemaPathForReinit)

    setupIpcHandlers()
    // 移除应用菜单（含「系统」「工具」子菜单），窗口顶部不再显示菜单栏
    Menu.setApplicationMenu(null)
    createWindow()
    restartBackupSchedule()
    restartUpdateScheduler()
  })
  .catch((e) => {
    console.error('[App] 启动失败:', e)
    dialog.showErrorBox('启动失败', e.message || String(e))
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
