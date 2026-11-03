/*
 * @Author: zhengrenfu
 * @Date: 2026-07-15 09:54:03
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04
 * @FilePath: \electron\main.ts
 * @Description: 主进程入口：窗口、菜单、档案激活与各服务装配
 */
import { app, BrowserWindow, Menu, shell, dialog } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { resolveFirstExisting } from '@electron/utils'
import { createApiClient } from '@electron/services/apiClient'
import { AppSettings, setupSettingsIpc } from '@electron/services/settingsService'
import {
  initProfileSystem,
  getProfileDir,
  getProfileSettingsPath,
  setupProfileIpc,
} from '@electron/services/profileService'
import { setupValidationIpc } from '@electron/services/validationService'
import { setupAiReviewIpc } from '@electron/services/aiReviewService'
import { setupNotificationIpc } from '@electron/services/notificationService'
import { setupSysNotificationIpc } from '@electron/services/sysNotificationService'
import { setupExcelIpc } from '@electron/services/excelService'
import { setupHistoryIpc, performBackup } from '@electron/services/historyService'

/** 窗口标题与任务栏用中文；存储路径由 package.json 的 productName 决定，保持英文 */
const APP_TITLE = '任务管理器'
let mainWindow: BrowserWindow | null = null

// 档案与设置状态
let activeProfile = ''
let schemaPathForReinit = ''
let settings: AppSettings

// 备份定时器
let backupTimer: ReturnType<typeof setInterval> | null = null

// #region 数据目录
/** 获取通用存储目录（基于当前激活档案） */
function getStoreDir(): string {
  const dir = join(getProfileDir(activeProfile), 'store')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** 获取历史数据目录（基于当前激活档案） */
function getHistoryDir(): string {
  const dir = join(getProfileDir(activeProfile), 'history')
  mkdirSync(dir, { recursive: true })
  return dir
}
// #endregion

// #region 备份定时器
/** 备份间隔下限（分钟），防止非法配置导致高频备份 */
const MIN_BACKUP_INTERVAL = 10

/**
 * 根据设置重新配置备份定时器
 */
function setupBackup(): void {
  if (backupTimer) {
    clearInterval(backupTimer)
    backupTimer = null
  }
  const enabled = settings.get('history.backupEnabled', false)
  if (!enabled) return
  const intervalMin = Math.max(
    MIN_BACKUP_INTERVAL,
    Number(settings.get('history.backupInterval', 60)) || MIN_BACKUP_INTERVAL,
  )
  const dirs: string[] = settings.get('history.backupDirectories', [])
  if (!dirs.length) return
  backupTimer = setInterval(
    () => {
      const ok = performBackup(dirs, getHistoryDir, getStoreDir)
      // 备份成功后通知渲染进程刷新上次备份时间，长时间运行时界面不显示陈旧时间
      if (ok > 0) {
        mainWindow?.webContents.send('event:backupCompleted')
      }
    },
    intervalMin * 60 * 1000,
  )
}
// #endregion

// #region 菜单
function setupMenu(): void {
  const getWin = () => BrowserWindow.getAllWindows()[0]
  const send = (action: string) => {
    const win = getWin()
    win?.webContents.send('menu:event', { action })
  }
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '系统',
      submenu: [
        { label: '设置', click: () => send('settings') },
        { type: 'separator' },
        // 不带快捷键，Alt+F4 由系统自己处理
        { label: '退出', role: 'quit' },
      ],
    },
    {
      label: '工具',
      submenu: [
        { label: '数据迁移', click: () => send('migrate') },
        {
          label: '开发者工具',
          click: () => {
            const win = getWin()
            win?.webContents.toggleDevTools()
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
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
    mainWindow?.maximize()
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}
// #endregion

// #region 档案激活
/**
 * 激活指定档案：重建 settings 实例、重启备份定时器、通知渲染进程
 * @param {string} name 档案名称
 */
function activateProfile(name: string): void {
  activeProfile = name
  settings = new AppSettings(getProfileSettingsPath(name), schemaPathForReinit)
  setupBackup()
  mainWindow?.webContents.send('profile:switched', name)
}
// #endregion

// #region IPC 装配
function setupIpcHandlers(): void {
  const api = createApiClient(() => settings.get('connection.apiBaseUrl', 'https://xmgl.cdrunnet.com'))

  setupSettingsIpc({
    getSettings: () => settings,
    mainWindow,
    getStoreDir,
    onBackupSettingChanged: setupBackup,
  })
  setupValidationIpc(api, { getSettings: () => settings })
  setupAiReviewIpc(api, { getSettings: () => settings })
  setupNotificationIpc(api)
  setupSysNotificationIpc(() => mainWindow)
  setupExcelIpc({ api, mainWindow })
  setupHistoryIpc({
    api,
    getSettings: () => settings,
    getHistoryDir,
    getStoreDir,
    performBackupFn: performBackup,
    restartBackup: setupBackup,
  })
  setupProfileIpc({
    getActiveProfile: () => activeProfile,
    onActivate: activateProfile,
  })
}
// #endregion

// Linux 兼容：禁用 GPU 硬件加速（解决 VMware 虚拟机 GPU 初始化失败问题）
// 注意：ozone-platform 通过 vite.config.ts 的 onstart 以 CLI 参数传递
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu')
  app.commandLine.appendSwitch('disable-gpu-compositing')
}

// 单实例锁
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
    // Windows 系统通知必需：这里必须与 electron-builder.yml 的 appId 一致，
    // 安装包给开始菜单快捷方式登记的也是这个值，两边不一致通知不会显示
    app.setAppUserModelId('com.zhengrenfu.taskmanager')

    // 初始化档案系统：确定当前激活的用户档案
    activeProfile = initProfileSystem()

    // 解析 schema 路径
    schemaPathForReinit = resolveFirstExisting([
      join(app.getAppPath(), 'assets', 'settings_schema.json'),
      join(app.getAppPath(), '..', 'assets', 'settings_schema.json'),
      join(import.meta.dirname, '..', 'assets', 'settings_schema.json'),
    ])

    // 初始化设置：指向当前档案的 settings.json
    settings = new AppSettings(getProfileSettingsPath(activeProfile), schemaPathForReinit)

    setupIpcHandlers()
    createWindow()
    setupMenu()
    setupBackup()
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
