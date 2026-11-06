/*
 * @Author: Himmeltala
 * @Date: 2026-11-05 10:40:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-05 13:30:00
 * @FilePath: \electron\services\fileService.ts
 * @Description: 文件对话框、文本与图片写入服务
 */

import { ipcMain, dialog, clipboard, nativeImage } from 'electron'
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

  // 二进制写入：PNG 等图片由渲染进程转 base64 传入，写文件或存剪贴板
  ipcMain.handle('file:writeBinaryFile', (_e, params) => {
    const { filePath, dataBase64 } = params
    writeFileSync(filePath, Buffer.from(dataBase64, 'base64'))
  })

  ipcMain.handle('clipboard:writeImagePng', (_e, params) => {
    const { dataBase64 } = params
    clipboard.writeImage(nativeImage.createFromBuffer(Buffer.from(dataBase64, 'base64')))
  })

  // 纯文本写剪贴板：图片复制失败时把 mermaid 源码等文本带出去
  ipcMain.handle('clipboard:writeText', (_e, params) => {
    clipboard.writeText(String(params?.text || ''))
  })
}
