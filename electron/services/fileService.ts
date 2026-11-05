/*
 * @Author: Himmeltala
 * @Date: 2026-11-05 10:40:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-05 10:40:00
 * @FilePath: \electron\services\fileService.ts
 * @Description: 文件对话框与文本写入服务
 */

import { ipcMain, dialog } from 'electron'
import type { BrowserWindow, OpenDialogOptions, SaveDialogOptions } from 'electron'
import { writeFileSync } from 'fs'

// 打开文件或目录选择框，取消时返回 null
export async function pickOpenPath(
  getWindow: () => BrowserWindow | null,
  options: OpenDialogOptions,
): Promise<string | null> {
  const win = getWindow()
  const parent = win && !win.isDestroyed() ? win : null
  const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
  return result.canceled ? null : result.filePaths?.[0] || null
}

// 打开保存对话框，取消时返回 null
export async function pickSavePath(
  getWindow: () => BrowserWindow | null,
  options: SaveDialogOptions,
): Promise<string | null> {
  const win = getWindow()
  const parent = win && !win.isDestroyed() ? win : null
  const result = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options)
  return result.canceled ? null : result.filePath || null
}

// 注册文件对话框与文本写入 IPC
export function setupFileIpc(deps: { getWindow: () => BrowserWindow | null }): void {
  const { getWindow } = deps

  ipcMain.handle('dialog:openFile', async (_e, params) => {
    const { filters, properties } = params || {}
    return pickOpenPath(getWindow, {
      properties: properties || ['openFile'],
      filters: filters || [{ name: '所有文件', extensions: ['*'] }],
    })
  })

  ipcMain.handle('dialog:saveFile', async (_e, params) => {
    const { defaultName, filters } = params
    return pickSavePath(getWindow, {
      defaultPath: defaultName,
      filters: filters || [{ name: 'Excel 文件', extensions: ['xlsx'] }],
    })
  })

  ipcMain.handle('file:writeTextFile', async (_e, params) => {
    const { filePath, content } = params
    writeFileSync(filePath, content, 'utf-8')
  })
}
