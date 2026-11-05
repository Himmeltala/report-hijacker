/*
 * @Author: zhengrenfu
 * @Date: 2026-08-04
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-05 10:40:00
 * @FilePath: \electron\services\profileService.ts
 * @Description: 用户档案服务：档案目录管理及档案 IPC
 */

import { app, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { readJsonFile, writeJsonAtomic } from '@electron/utils'

// #region 辅助函数

/**
 * 校验档案名称，非法时抛错：拒绝路径分隔符、Windows 保留字符、相对路径及以空格或点结尾的名称
 * @param {string} name 档案名称
 * @returns {string} 校验通过后的档案名
 */
function assertValidProfileName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('名称不能为空')
  if (trimmed === '.' || trimmed === '..') throw new Error('名称不能为相对路径')
  if (/[\\/]/.test(trimmed)) throw new Error('名称不能包含路径分隔符')
  if (/[<>:"|?*]/.test(trimmed)) throw new Error('名称不能包含 Windows 保留字符')
  if (/[\s.]$/.test(trimmed)) throw new Error('名称不能以空格或点结尾')
  return trimmed
}

/**
 * 检查档案名与现有列表是否大小写不敏感重复，Windows 不区分大小写时重名会覆盖目录
 * @param {string[]} list 现有档案名列表
 * @param {string} name 待检查名称
 * @param {string} [exclude] 需要排除的档案名
 * @returns {boolean} 存在冲突时为 true
 */
function hasNameConflict(list: string[], name: string, exclude?: string): boolean {
  const lower = name.toLowerCase()
  return list.some((n) => n !== exclude && n.toLowerCase() === lower)
}

// #endregion

// #region 路径工具

function getProfilesListPath(): string {
  return join(app.getPath('userData'), 'profiles.json')
}

function getActiveProfilePath(): string {
  return join(app.getPath('userData'), 'active-profile.json')
}

function getProfilesBaseDir(): string {
  return join(app.getPath('userData'), 'profiles')
}

export function getProfileDir(name: string): string {
  return join(getProfilesBaseDir(), name)
}

export function getProfileSettingsPath(name: string): string {
  return join(getProfileDir(name), 'settings.json')
}

// #endregion

// #region 档案读写

function readActiveProfile(): string {
  const data = readJsonFile<{ name?: string }>(getActiveProfilePath(), {})
  return data.name || ''
}

// 写入当前激活档案名，原子写入避免崩溃留下截断文件
function writeActiveProfile(name: string): void {
  writeJsonAtomic(getActiveProfilePath(), { name }, 0)
}

function readProfilesList(): string[] {
  return readJsonFile<string[]>(getProfilesListPath(), [])
}

function writeProfilesList(names: string[]): void {
  writeJsonAtomic(getProfilesListPath(), names, 0)
}

/**
 * 创建档案目录，含 history 与 store 子目录
 * @param {string} name 档案名称
 */
function ensureProfileDir(name: string): void {
  const dir = getProfileDir(name)
  mkdirSync(dir, { recursive: true })
  mkdirSync(join(dir, 'history'), { recursive: true })
  mkdirSync(join(dir, 'store'), { recursive: true })
}

// #endregion

// #region 初始化

/**
 * 初始化档案系统，无有效激活档案时创建默认档案
 * @returns {string} 当前激活的档案名称
 */
export function initProfileSystem(): string {
  const current = readActiveProfile()

  if (current && readProfilesList().includes(current)) {
    return current
  }

  const defaultName = '默认用户'
  ensureProfileDir(defaultName)
  const list = readProfilesList()
  if (!list.includes(defaultName)) {
    list.push(defaultName)
    writeProfilesList(list)
  }
  writeActiveProfile(defaultName)
  return defaultName
}

// #endregion

// #region IPC 注册

/**
 * 注册用户档案管理 IPC
 * @param {object} deps 依赖项
 * @param {() => string} deps.getActiveProfile 获取当前激活档案
 * @param {(name: string) => void} deps.onActivate 激活档案回调
 */
export function setupProfileIpc(deps: { getActiveProfile: () => string; onActivate: (name: string) => void }): void {
  const { getActiveProfile, onActivate } = deps

  ipcMain.handle('profile:current', () => {
    return getActiveProfile()
  })

  ipcMain.handle('profile:list', () => {
    return readProfilesList()
  })

  ipcMain.handle('profile:switch', (_e, name: string) => {
    assertValidProfileName(name)
    if (!readProfilesList().includes(name)) {
      throw new Error(`档案 "${name}" 不存在`)
    }
    writeActiveProfile(name)
    onActivate(name)
  })

  ipcMain.handle('profile:add', (_e, name: string) => {
    const trimmed = assertValidProfileName(name)
    const list = readProfilesList()
    if (list.includes(trimmed)) throw new Error(`档案 "${trimmed}" 已存在`)
    // Windows 文件系统不区分大小写，拒绝与现有档案大小写相近的名称
    if (hasNameConflict(list, trimmed)) throw new Error(`档案 "${trimmed}" 与现有档案名称冲突`)
    ensureProfileDir(trimmed)
    list.push(trimmed)
    writeProfilesList(list)
    return list
  })

  ipcMain.handle('profile:rename', (_e, oldName: string, newName: string) => {
    assertValidProfileName(oldName)
    const trimmed = assertValidProfileName(newName)
    if (oldName === trimmed) return readProfilesList()
    const list = readProfilesList()
    if (!list.includes(oldName)) throw new Error(`档案 "${oldName}" 不存在`)
    if (list.includes(trimmed)) throw new Error(`档案 "${trimmed}" 已存在`)
    // 冲突检查排除原名，允许纯大小写调整
    if (hasNameConflict(list, trimmed, oldName)) throw new Error(`档案 "${trimmed}" 与现有档案名称冲突`)
    const oldDir = getProfileDir(oldName)
    const newDir = getProfileDir(trimmed)
    if (existsSync(oldDir)) {
      renameSync(oldDir, newDir)
    }
    const newList = list.map((n) => (n === oldName ? trimmed : n))
    writeProfilesList(newList)
    if (getActiveProfile() === oldName) {
      writeActiveProfile(trimmed)
      onActivate(trimmed)
    }
    return newList
  })

  ipcMain.handle('profile:delete', (_e, name: string) => {
    assertValidProfileName(name)
    const list = readProfilesList()
    if (!list.includes(name)) throw new Error(`档案 "${name}" 不存在`)
    if (list.length <= 1) throw new Error('至少保留一个档案')
    const dir = getProfileDir(name)
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true })
    }
    const newList = list.filter((n) => n !== name)
    writeProfilesList(newList)
    if (getActiveProfile() === name) {
      writeActiveProfile(newList[0])
      onActivate(newList[0])
    }
    return newList
  })
}

// #endregion
