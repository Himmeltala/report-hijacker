/*
 * @Author: zhengrenfu
 * @Date: 2026-11-04
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-06 23:15:00
 * @FilePath: \electron\services\updateService.ts
 * @Description: 应用更新服务：用 electron-updater 检查并下载更新包，下载完成后退出本程序并启动安装程序
 */

import { app, ipcMain, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { sendToWindow, writeJsonAtomic } from '@electron/utils'
import { getErrorMessage } from '@/utils/error'
import type { AppSettings } from '@electron/services/settingsService'
import type {
  UpdateApplyResult,
  UpdateCheckResult,
  UpdateFrequency,
  UpdateProgress,
  UpdateStatus,
} from '@/types/update'

// #region 常量

// 更新源默认地址，指向 latest.yml 与安装包所在目录
const DEFAULT_FEED_URL = 'http://11.1.1.184:3000/'

// 进度事件发送节流间隔
const PROGRESS_INTERVAL_MS = 200

// #endregion

// #region 类型

// 更新状态文件内容，记录上次检查时间
interface UpdateState {
  lastCheckAt: string
}

/** 共用的依赖注入 */
export interface UpdateDeps {
  getSettings: () => AppSettings
  getWindow: () => BrowserWindow | null
}

// #endregion

// #region 状态文件

// 更新相关文件的存放目录
function updateDir(): string {
  const dir = join(app.getPath('userData'), 'update')
  mkdirSync(dir, { recursive: true })
  return dir
}

function stateFilePath(): string {
  return join(updateDir(), 'update-state.json')
}

// 读取更新状态文件，缺失或损坏时返回空状态
function readState(): UpdateState {
  try {
    const raw = JSON.parse(readFileSync(stateFilePath(), 'utf-8'))
    return { lastCheckAt: String(raw?.lastCheckAt || '') }
  } catch {
    return { lastCheckAt: '' }
  }
}

function saveLastCheck(checkedAt: string): void {
  writeJsonAtomic(stateFilePath(), { lastCheckAt: checkedAt } satisfies UpdateState, 2)
}

// #endregion

// #region 更新源与进度

/**
 * 按设置把更新源指向 latest.yml 所在目录
 * @param {AppSettings} settings 应用设置
 */
function applyFeedUrl(settings: AppSettings): void {
  const url = String(settings.get('update.feedUrl', DEFAULT_FEED_URL) || '').trim()
  if (!url) throw new Error('未设置更新源地址')
  autoUpdater.setFeedURL({ provider: 'generic', url })
}

// 进度上报节流包装
function createProgressReporter(send: (p: UpdateProgress) => void): (p: UpdateProgress) => void {
  let last = 0
  return (p) => {
    const now = Date.now()
    if (p.percent < 100 && now - last < PROGRESS_INTERVAL_MS) return
    last = now
    send(p)
  }
}

// #endregion

// #region 检查更新

/**
 * 按设置执行一次检查，异常转成结果里的 error 字段，不抛给调用方
 * @param {UpdateDeps} deps 设置与窗口依赖
 * @returns {Promise<UpdateCheckResult>} 检查结果
 */
async function checkForUpdate(deps: UpdateDeps): Promise<UpdateCheckResult> {
  const checkedAt = new Date().toISOString()
  try {
    applyFeedUrl(deps.getSettings())
    const result = await autoUpdater.checkForUpdates()
    const info = result?.updateInfo
    const hasUpdate = !!result?.isUpdateAvailable && !!info
    saveLastCheck(checkedAt)
    if (!hasUpdate) return { hasUpdate: false, checkedAt }
    return { hasUpdate: true, version: info?.version, checkedAt }
  } catch (e) {
    saveLastCheck(checkedAt)
    return { hasUpdate: false, error: getErrorMessage(e, '检查更新失败'), checkedAt }
  }
}

// 读取更新频率，非法值按定时检查处理
export function readUpdateFrequency(settings: AppSettings): UpdateFrequency {
  const value = settings.get('update.frequency', 'interval')
  return value === 'startup' || value === 'off' ? value : 'interval'
}

// 组装设置面板用的更新状态
function buildStatus(deps: UpdateDeps): UpdateStatus {
  const state = readState()
  return {
    currentVersion: app.getVersion(),
    lastCheckAt: state.lastCheckAt || null,
    frequency: readUpdateFrequency(deps.getSettings()),
    packaged: app.isPackaged,
    platform: process.platform,
  }
}

// #endregion

// #region 应用更新

// 已开始下载或安装，避免重复触发
let installing = false

/**
 * 下载更新包，下载完成后退出本程序并启动安装程序
 *
 * 关闭旧进程与提权都交给安装器：electron-updater 启动安装程序时带 --updated，
 * NSIS 据此关闭正在运行的实例，perMachine 安装由 elevate.exe 走 UAC 提权
 * @param {UpdateDeps} deps 设置与窗口依赖
 * @returns {Promise<UpdateApplyResult>} 是否已开始更新及失败原因
 */
async function applyUpdate(deps: UpdateDeps): Promise<UpdateApplyResult> {
  if (!app.isPackaged) return { started: false, error: '开发模式下不执行安装，请打包后使用' }
  if (installing) return { started: false, error: '更新正在处理，请稍候' }
  installing = true
  try {
    applyFeedUrl(deps.getSettings())
    await autoUpdater.downloadUpdate()
    autoUpdater.quitAndInstall()
    return { started: true }
  } catch (e) {
    installing = false
    return { started: false, error: getErrorMessage(e, '更新失败') }
  }
}

// #endregion

// #region 自动检查

let checking = false
// 本次运行已提示过的版本，避免同一版本反复弹窗
let notifiedVersion = ''

// 执行一次自动检查，发现新版本时通知渲染进程弹窗
export async function runAutoCheck(deps: UpdateDeps): Promise<void> {
  if (checking) return
  checking = true
  try {
    const result = await checkForUpdate(deps)
    if (!result.hasUpdate || !result.version) return
    if (result.version === notifiedVersion) return
    notifiedVersion = result.version
    sendToWindow(deps.getWindow, 'event:updateAvailable', result)
  } finally {
    checking = false
  }
}

// #endregion

// #region 装配

// 注册更新相关 IPC 与事件，定时检查由 schedules/main/updateSchedule.ts 负责
export function setupUpdateService(deps: UpdateDeps): void {
  // 开发模式没有 app-update.yml，打开开发配置开关后检查更新仍可用
  autoUpdater.forceDevUpdateConfig = !app.isPackaged
  // 检查后不自动下载，由用户确认后手动触发
  autoUpdater.autoDownload = false
  // 不在退出时静默安装，安装统一走 quitAndInstall
  autoUpdater.autoInstallOnAppQuit = false
  // 更新源不支持 Range 分段请求，关掉差分下载，整包下载
  autoUpdater.disableDifferentialDownload = true

  const report = createProgressReporter((p) => sendToWindow(deps.getWindow, 'event:updateProgress', p))
  autoUpdater.on('download-progress', (p) => {
    report({ phase: 'download', received: p.transferred, total: p.total, percent: Math.floor(p.percent) })
  })

  ipcMain.handle('update:check', () => checkForUpdate(deps))
  ipcMain.handle('update:status', () => buildStatus(deps))
  ipcMain.handle('update:apply', () => applyUpdate(deps))
}

// #endregion
