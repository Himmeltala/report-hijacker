/*
 * @Author: Himmeltala
 * @Date: 2026-11-05 10:40:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-05 10:40:00
 * @FilePath: \electron\services\storeService.ts
 * @Description: 通用数据存储服务：store 文件的读写约定与 IPC
 */

import { ipcMain } from 'electron'
import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import { listJsonBasenames, readJsonFile, writeJsonAtomic } from '@electron/utils'

// 由存储目录与键名得到 store 文件路径
export function storeFilePath(dir: string, key: string): string {
  return join(dir, `${key}.json`)
}

// 读取 store 值，文件缺失或损坏时返回默认值
export function readStoreValue<T>(dir: string, key: string, fallback: T): T {
  return readJsonFile<T>(storeFilePath(dir, key), fallback)
}

// 写入 store 值，使用原子写避免崩溃留下截断文件
export function writeStoreValue(dir: string, key: string, value: any, indent = 2): void {
  writeJsonAtomic(storeFilePath(dir, key), value, indent)
}

// 注册通用数据存储 IPC
export function setupStoreIpc(deps: { getStoreDir: () => string }): void {
  const { getStoreDir } = deps

  ipcMain.handle('store:get', (_e, key: string) => readStoreValue(getStoreDir(), key, null))
  ipcMain.handle('store:set', (_e, key: string, value: any) => {
    if (value === undefined) throw new Error('store:set 不支持 undefined 值')
    writeStoreValue(getStoreDir(), key, value)
  })
  ipcMain.handle('store:delete', (_e, key: string) => {
    const filePath = storeFilePath(getStoreDir(), key)
    if (existsSync(filePath)) rmSync(filePath)
  })
  ipcMain.handle('store:keys', () => listJsonBasenames(getStoreDir()))
}
