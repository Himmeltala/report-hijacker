/*
 * @Author: zhengrenfu
 * @Date: 2026-11-04
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 16:45:00
 * @FilePath: \electron\services\updateService.ts
 * @Description: 应用更新服务：从共享盘或更新接口检查安装包，校验 MD5 后启动安装程序
 */

import { app, ipcMain, BrowserWindow, shell } from 'electron'
import { createHash } from 'crypto'
import { Readable } from 'stream'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs'
import { basename, extname, join } from 'path'
import type { AppSettings } from '@electron/services/settingsService'
import type {
  UpdateApplyParams,
  UpdateApplyResult,
  UpdateCheckResult,
  UpdateProgress,
  UpdateStatus,
} from '@/types/update'

// #region 常量

/** 检查接口请求超时 */
const HTTP_TIMEOUT_MS = 30_000

/** 下载安装包的网络超时，安装包较大，留足时间 */
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000

/** 自动检查间隔下限（小时），防止非法配置导致高频检查 */
const MIN_INTERVAL_HOURS = 1

/** 启动检查延迟，避开启动阶段的网络与磁盘争用 */
const STARTUP_CHECK_DELAY_MS = 30_000

/** 进度事件发送节流间隔 */
const PROGRESS_INTERVAL_MS = 200

/** 启动安装程序后等待多久退出本程序 */
const QUIT_DELAY_MS = 1_500

// #endregion

// #region 类型

/** 更新状态文件内容，记录已安装安装包的 MD5 用于判断共享盘安装包是否变化 */
interface UpdateState {
  installedMd5: string
  installedVersion: string
  lastCheckAt: string
  /** 已启动安装但尚未确认安装成功的更新包，下次启动时对账 */
  pending?: { md5: string; version: string; at: string }
}

/** 检查结果去掉检查时间，由统一入口补上 */
type CheckPayload = Omit<UpdateCheckResult, 'checkedAt'>

/** 共用的依赖注入 */
export interface UpdateDeps {
  getSettings: () => AppSettings
  getWindow: () => BrowserWindow | null
}

/** 单个安装包的位置与基本信息 */
interface InstallerFile {
  filePath: string
  fileName: string
  size: number
}

// #endregion

// #region 状态文件

/** 更新相关文件的存放目录 */
function updateDir(): string {
  const dir = join(app.getPath('userData'), 'update')
  mkdirSync(dir, { recursive: true })
  return dir
}

function stateFilePath(): string {
  return join(updateDir(), 'update-state.json')
}

/** 读取更新状态文件，缺失或损坏时返回空状态 */
function readState(): UpdateState {
  try {
    const raw = JSON.parse(readFileSync(stateFilePath(), 'utf-8'))
    return {
      installedMd5: String(raw?.installedMd5 || ''),
      installedVersion: String(raw?.installedVersion || ''),
      lastCheckAt: String(raw?.lastCheckAt || ''),
      pending: raw?.pending,
    }
  } catch {
    return { installedMd5: '', installedVersion: '', lastCheckAt: '' }
  }
}

function writeState(state: UpdateState): void {
  mkdirSync(updateDir(), { recursive: true })
  writeFileSync(stateFilePath(), JSON.stringify(state, null, 2), 'utf-8')
}

/**
 * 启动时对账上次更新：安装成功则把待定 MD5 记为已安装，安装中途取消则丢弃待定记录
 *
 * 版本号对不上说明安装没走到最后，丢弃后下次检查仍会提示更新
 */
function reconcilePendingUpdate(): void {
  const state = readState()
  if (!state.pending) return
  const pending = state.pending
  const installed = app.getVersion()
  const committed = !pending.version || pending.version === installed
  if (committed) {
    state.installedMd5 = pending.md5
    state.installedVersion = installed
  }
  delete state.pending
  writeState(state)
}

// #endregion

// #region 文件工具

/** 计算文件 MD5，流式读取避免整包进内存 */
function md5File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('md5')
    const stream = createReadStream(file)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

/** 从文件名里取版本号，取不到返回空字符串 */
function parseVersion(fileName: string): string {
  const match = /(\d+\.\d+\.\d+(?:\.\d+)?)/.exec(fileName)
  return match ? match[1] : ''
}

/** 取目录中修改时间最新的 exe 安装包 */
function pickLatestInstaller(dir: string): InstallerFile | null {
  let latest: (InstallerFile & { mtime: number }) | null = null
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.exe') continue
    const filePath = join(dir, entry.name)
    try {
      const info = statSync(filePath)
      if (!latest || info.mtimeMs > latest.mtime) {
        latest = { filePath, fileName: entry.name, size: info.size, mtime: info.mtimeMs }
      }
    } catch {
      // 单个文件读不到时跳过，不影响其他候选
    }
  }
  return latest
}

/**
 * 解析共享盘配置：填目录时取目录里最新的安装包，填到具体文件时直接用它
 * @param {string} sharePath 设置里的共享盘路径
 * @returns {InstallerFile} 安装包位置与大小
 */
function resolveShareInstaller(sharePath: string): InstallerFile {
  const target = String(sharePath || '').trim()
  if (!target) throw new Error('未设置共享盘路径')
  if (!existsSync(target)) throw new Error(`共享盘路径不存在: ${target}`)
  const info = statSync(target)
  if (info.isFile()) {
    if (extname(target).toLowerCase() !== '.exe') throw new Error('共享盘路径指向的文件不是 exe 安装包')
    return { filePath: target, fileName: basename(target), size: info.size }
  }
  if (!info.isDirectory()) throw new Error('共享盘路径既不是文件也不是目录')
  const latest = pickLatestInstaller(target)
  if (!latest) throw new Error('共享盘目录里没有 exe 安装包')
  return latest
}

/** 带进度的文件复制 */
function copyWithProgress(src: string, dest: string, report: (p: UpdateProgress) => void): Promise<void> {
  const total = statSync(src).size
  let received = 0
  return new Promise((resolve, reject) => {
    const reader = createReadStream(src)
    const writer = createWriteStream(dest)
    reader.on('data', (chunk) => {
      received += chunk.length
      report({ phase: 'copy', received, total, percent: total ? Math.floor((received / total) * 100) : 0 })
    })
    reader.on('error', reject)
    writer.on('error', reject)
    writer.on('finish', () => {
      report({ phase: 'copy', received: total, total, percent: 100 })
      resolve()
    })
    reader.pipe(writer)
  })
}

/** 带进度的安装包下载 */
async function downloadWithProgress(url: string, dest: string, report: (p: UpdateProgress) => void): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
  if (!response.ok || !response.body) throw new Error(`下载更新包失败: HTTP ${response.status}`)
  const total = Number(response.headers.get('content-length') || 0)
  const source = Readable.fromWeb(response.body as any)
  const writer = createWriteStream(dest)
  let received = 0
  await new Promise<void>((resolve, reject) => {
    source.on('data', (chunk: Buffer) => {
      received += chunk.length
      report({ phase: 'download', received, total, percent: total ? Math.floor((received / total) * 100) : 0 })
    })
    source.on('error', reject)
    writer.on('error', reject)
    writer.on('finish', () => {
      report({ phase: 'download', received, total, percent: 100 })
      resolve()
    })
    source.pipe(writer)
  })
}

/** 向渲染进程发送事件，窗口已销毁时静默跳过 */
function sendToWindow(deps: UpdateDeps, channel: string, payload: unknown): void {
  const win = deps.getWindow()
  if (!win || win.isDestroyed()) return
  win.webContents.send(channel, payload)
}

/** 进度上报节流包装 */
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

/** 共享盘方式检查：比较安装包 MD5 与本地已安装包 MD5 */
async function checkShare(sharePath: string, installedMd5: string): Promise<CheckPayload> {
  const installer = resolveShareInstaller(sharePath)
  const md5 = await md5File(installer.filePath)
  const version = parseVersion(installer.fileName)
  // 首次检查没有 MD5 记录，且共享盘包版本与当前版本一致时视为已安装，避免刚装好就提示更新
  const initialized = !installedMd5 && !!version && version === app.getVersion()
  return {
    hasUpdate: !initialized && md5 !== installedMd5,
    source: 'share',
    version,
    fileName: installer.fileName,
    filePath: installer.filePath,
    md5,
    size: installer.size,
  }
}

/** 把接口返回的下载地址转成绝对地址，相对路径按接口地址补全 */
function resolveDownloadUrl(raw: string, apiUrl: string): string {
  const value = String(raw || '').trim()
  if (!value) return ''
  try {
    return new URL(value, apiUrl).toString()
  } catch {
    return ''
  }
}

/** 接口方式检查：版本号或 MD5 与已安装的不同即视为有更新 */
async function checkHttp(apiUrl: string, installedMd5: string): Promise<CheckPayload> {
  const url = String(apiUrl || '').trim()
  if (!url) throw new Error('未设置更新接口地址')
  const response = await fetch(url, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) })
  if (!response.ok) throw new Error(`更新接口返回 HTTP ${response.status}`)
  const data: any = await response.json()
  const version = String(data?.version || '').trim()
  if (!version) return { hasUpdate: false, source: 'http' }
  const md5 = String(data?.md5 || '').toLowerCase()
  const notes = String(data?.notes || '')
  const installedVersion = app.getVersion()
  const alreadyInstalled = !!md5 && md5 === installedMd5
  if (version === installedVersion || alreadyInstalled) {
    return { hasUpdate: false, source: 'http', version, md5: md5 || undefined, notes }
  }
  const downloadUrl = resolveDownloadUrl(String(data?.url || ''), url)
  if (!downloadUrl) throw new Error('更新接口没有返回可用的下载地址')
  if (!md5) throw new Error('更新接口没有返回 MD5，无法校验更新包')
  return { hasUpdate: true, source: 'http', version, url: downloadUrl, md5: md5 || undefined, notes }
}

/**
 * 按设置执行一次检查，异常转成结果里的 error 字段，不抛给调用方
 * @param {UpdateDeps} deps 设置与窗口依赖
 * @returns {Promise<UpdateCheckResult>} 检查结果
 */
async function checkForUpdate(deps: UpdateDeps): Promise<UpdateCheckResult> {
  const settings = deps.getSettings()
  const source: 'share' | 'http' = settings.get('update.mode', 'share') === 'http' ? 'http' : 'share'
  const state = readState()
  const checkedAt = new Date().toISOString()
  let payload: CheckPayload
  try {
    payload =
      source === 'share'
        ? await checkShare(settings.get('update.sharePath', ''), state.installedMd5)
        : await checkHttp(settings.get('update.apiUrl', ''), state.installedMd5)
  } catch (e: any) {
    payload = { hasUpdate: false, source, error: e?.message || '检查更新失败' }
  }
  // 首次检查没有 MD5 记录且已是最新时，把当前安装包 MD5 补记为已安装
  if (!state.installedMd5 && payload.md5 && !payload.hasUpdate) {
    state.installedMd5 = payload.md5
    state.installedVersion = app.getVersion()
  }
  state.lastCheckAt = checkedAt
  writeState(state)
  return { ...payload, checkedAt }
}

/** 组装设置面板用的更新状态 */
function buildStatus(deps: UpdateDeps): UpdateStatus {
  const state = readState()
  return {
    currentVersion: app.getVersion(),
    installedMd5: state.installedMd5,
    installedVersion: state.installedVersion,
    lastCheckAt: state.lastCheckAt || null,
    mode: deps.getSettings().get('update.mode', 'share') === 'http' ? 'http' : 'share',
    enabled: !!deps.getSettings().get('update.enabled', true),
    packaged: app.isPackaged,
    platform: process.platform,
  }
}

// #endregion

// #region 应用更新

/**
 * 用系统 Shell 启动安装程序并安排本程序退出，安装完成后由 NSIS 的 runAfterFinish 打开新版
 *
 * 安装包按所有用户安装，清单要求管理员权限，直接 spawn 会因未提权返回 EACCES，
 * 改由 ShellExecute 启动，由系统弹 UAC 提权。
 * @param {string} file 安装包路径
 * @returns {Promise<string>} 启动失败原因，成功返回空字符串
 */
async function launchInstaller(file: string): Promise<string> {
  try {
    // 用户取消 UAC 提权时这里会返回错误，保留本程序让用户看到原因
    const error = await shell.openPath(file)
    if (error) return error
  } catch (e: any) {
    return e?.message || '未知错误'
  }
  setTimeout(() => {
    if (installing) app.quit()
  }, QUIT_DELAY_MS)
  return ''
}

/**
 * 应用更新：复制或下载安装包到本地缓存，校验 MD5 后启动安装程序
 * @param {UpdateDeps} deps 设置与窗口依赖
 * @param {UpdateApplyParams} payload 检查结果里带过来的更新包信息
 * @returns {Promise<UpdateApplyResult>} 是否已启动安装及失败原因
 */
async function applyUpdate(deps: UpdateDeps, payload?: UpdateApplyParams): Promise<UpdateApplyResult> {
  if (!app.isPackaged) return { started: false, error: '开发模式下不执行安装，请打包后使用' }
  if (installing) return { started: false, error: '安装程序正在启动，请稍候' }
  if (!payload?.source) return { started: false, error: '缺少更新包信息' }
  if (process.platform !== 'win32') return { started: false, error: '仅 Windows 支持自动安装更新' }
  const report = createProgressReporter((p) => sendToWindow(deps, 'event:updateProgress', p))
  const pkgDir = join(updateDir(), 'pkg')
  const fileName = basename(String(payload?.fileName || '').trim()) || 'installer.exe'
  const target = join(pkgDir, fileName)
  try {
    rmSync(pkgDir, { recursive: true, force: true })
    mkdirSync(pkgDir, { recursive: true })

    if (payload.source === 'share') {
      const filePath = String(payload.filePath || '').trim()
      if (!filePath || !existsSync(filePath)) return { started: false, error: '更新包不存在，请重新检查更新' }
      await copyWithProgress(filePath, target, report)
    } else {
      const url = String(payload.url || '').trim()
      if (!url) return { started: false, error: '缺少更新包下载地址' }
      await downloadWithProgress(url, target, report)
    }

    const expected = String(payload.md5 || '').toLowerCase()
    const actual = await md5File(target)
    if (expected && actual !== expected) {
      rmSync(target, { force: true })
      return { started: false, error: '更新包 MD5 校验不通过，请重新检查更新' }
    }

    const state = readState()
    state.pending = {
      md5: actual,
      version: String(payload.version || parseVersion(target)),
      at: new Date().toISOString(),
    }
    writeState(state)

    installing = true
    const launchError = await launchInstaller(target)
    if (launchError) {
      installing = false
      // 安装没有开始，清掉待定记录，避免下次启动误记为已安装
      delete state.pending
      writeState(state)
      return { started: false, error: `安装程序启动失败: ${launchError}` }
    }
    return { started: true }
  } catch (e: any) {
    return { started: false, error: e?.message || '更新失败' }
  }
}

// #endregion

// #region 自动检查

let intervalTimer: ReturnType<typeof setInterval> | null = null
/** 已启动安装程序，避免重复触发安装 */
let installing = false
let startupTimer: ReturnType<typeof setTimeout> | null = null
let checking = false
/** 本次运行已提示过的更新包标识，避免同一版本反复弹窗 */
let notifiedKey = ''

/** 执行一次自动检查，发现新版本时通知渲染进程弹窗 */
async function runAutoCheck(deps: UpdateDeps): Promise<void> {
  if (checking) return
  checking = true
  try {
    const result = await checkForUpdate(deps)
    if (!result.hasUpdate) return
    const key = result.md5 || result.version || ''
    if (!key || key === notifiedKey) return
    notifiedKey = key
    sendToWindow(deps, 'event:updateAvailable', result)
  } finally {
    checking = false
  }
}

/** 按设置重建自动检查定时器，设置变更与切换档案后调用 */
function restartScheduler(deps: UpdateDeps): void {
  if (intervalTimer) {
    clearInterval(intervalTimer)
    intervalTimer = null
  }
  if (startupTimer) {
    clearTimeout(startupTimer)
    startupTimer = null
  }
  // 开发模式不自动检查，避免共享盘路径为空时反复报错
  if (!app.isPackaged) return
  const settings = deps.getSettings()
  if (!settings.get('update.enabled', true)) return
  const hours = Math.max(MIN_INTERVAL_HOURS, Number(settings.get('update.intervalHours', 6)) || 6)
  if (settings.get('update.checkOnStartup', true)) {
    startupTimer = setTimeout(() => runAutoCheck(deps), STARTUP_CHECK_DELAY_MS)
  }
  intervalTimer = setInterval(() => runAutoCheck(deps), hours * 60 * 60 * 1000)
}

// #endregion

// #region 装配

/**
 * 注册更新相关 IPC 与自动检查定时器
 * @param {UpdateDeps} deps 设置与窗口依赖
 * @returns {{ restartScheduler: () => void }} 设置变更后重建定时器的入口
 */
export function setupUpdateService(deps: UpdateDeps): { restartScheduler: () => void } {
  reconcilePendingUpdate()

  ipcMain.handle('update:check', () => checkForUpdate(deps))
  ipcMain.handle('update:status', () => buildStatus(deps))
  ipcMain.handle('update:apply', (_e, payload: UpdateApplyParams) => applyUpdate(deps, payload))

  const restart = () => restartScheduler(deps)
  restart()
  return { restartScheduler: restart }
}

// #endregion
