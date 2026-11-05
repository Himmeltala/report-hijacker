/*
 * @Author: zhengrenfu
 * @Date: 2026-08-04
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-05 10:40:00
 * @FilePath: \electron\services\excelService.ts
 * @Description: Excel 模板填充服务
 */

import { ipcMain, app } from 'electron'
import { dirname, join } from 'path'
import { copyFileSync, mkdirSync } from 'fs'
import { resolveFirstExisting, extractWpId, parseDurationToHours, formatDate } from '@electron/utils'
import { mapWithConcurrency } from '@electron/concurrency'
import type { ApiClient } from '@electron/services/apiClient'

// 导出时获取工作包详情的并发上限，避免大批量导出打爆平台接口
const DETAIL_CONCURRENCY = 5

// #region IPC 注册

// 注册 Excel 模板填充 IPC
export function setupExcelIpc(api: ApiClient): void {
  // #region 模板路径

  // 结果缓存，避免重复 stat
  let cachedTemplatePath: string | null = null
  const getBuiltinTemplatePath = (): string => {
    if (cachedTemplatePath !== null) return cachedTemplatePath
    cachedTemplatePath = resolveFirstExisting([
      join(app.getAppPath(), 'assets', 'templates', '模板.xlsx'),
      join(app.getAppPath(), '..', 'assets', 'templates', '模板.xlsx'),
      join(import.meta.dirname, '..', 'assets', 'templates', '模板.xlsx'),
    ])
    return cachedTemplatePath
  }

  // #endregion

  // #region Excel 模板填充

  ipcMain.handle('file:fillExcelTemplate', async (_e, params) => {
    const { tasks, targetPath, handlerName, cookie } = params
    const templatePath = params.templatePath || getBuiltinTemplatePath()
    if (!templatePath) {
      return { success: false, error: '未配置周报模板路径，且内置模板不存在' }
    }

    mkdirSync(dirname(targetPath), { recursive: true })
    copyFileSync(templatePath, targetPath)

    const { default: ExcelJS } = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(targetPath)
    const ws = wb.getWorksheet(1)
    if (!ws) {
      return { success: false, error: '模板中未找到工作表' }
    }

    const PLACEHOLDER_RE = /\{\{([^}]+)\}\}/g
    const now = new Date()
    const taskCount = tasks.length

    // #region 扫描模板结构

    const taskTemplateRows: number[] = []
    const summaryRows: number[] = []
    ws.eachRow((row, rowNumber) => {
      let hasTaskPlaceholder = false
      let hasSummaryPlaceholder = false
      row.eachCell((cell) => {
        const val = String(cell.value || '')
        if (val.includes('{{task.')) hasTaskPlaceholder = true
        if (val.includes('{{summary.')) hasSummaryPlaceholder = true
      })
      if (hasTaskPlaceholder) taskTemplateRows.push(rowNumber)
      if (hasSummaryPlaceholder) summaryRows.push(rowNumber)
    })

    // #endregion

    // #region 获取 API 数据

    const apiCache: Record<string, any> = {}
    const uniqueIds = Array.from(new Set(tasks.map((t) => extractWpId(t.rawUrl)).filter(Boolean))) as string[]
    const details = await mapWithConcurrency(uniqueIds, DETAIL_CONCURRENCY, (id) =>
      api.getWorkPackage(id, cookie).catch((e) => {
        console.error(`[Export] 获取任务详情失败 (ID: ${id}):`, e)
        return null
      }),
    )
    for (let i = 0; i < uniqueIds.length; i++) {
      apiCache[uniqueIds[i]] = details[i]
    }

    // #endregion

    // #region 构建任务数据

    function buildTaskData(task: any, index: number): Record<string, string> {
      const taskId = extractWpId(task.rawUrl)
      const detail = taskId ? apiCache[taskId] : null
      const data: Record<string, string> = {
        'task.seq': String(index + 1),
        'task.projectName': task.rawProjectName || '',
        'task.title': task.rawTitle || '',
        'task.remark': task.rawRemark || '',
        'task.url': task.rawUrl || '',
        'task.score': task.rawScore || '',
        'task.estimatedHours': task.rawEstimatedHours || '',
      }
      if (detail) {
        data['task.id'] = String(detail.id || '')
        data['task.subject'] = detail.subject || ''
        data['task.startDate'] = formatDate(detail.startDate || '')
        data['task.dueDate'] = formatDate(detail.dueDate || '')
        data['task.estimatedTime'] = parseDurationToHours(detail.estimatedTime || '')
        data['task.percentageDone'] = String(detail.percentageDone ?? '')
        data['task.createdAt'] = formatDate(detail.createdAt || '')
        data['task.updatedAt'] = formatDate(detail.updatedAt || '')
        data['task.customField1'] = String(detail.customField1 ?? '')
        data['task.customField105'] = String(detail.customField105 ?? '')
        data['task.customField107'] = String(detail.customField107 ?? '')
        data['task.status'] = detail._links?.status?.title || ''
        data['task.type'] = detail._links?.type?.title || ''
        data['task.priority'] = detail._embedded?.priority?.name || ''
        data['task.project'] = detail._embedded?.project?.name || ''
        data['task.author'] = detail._embedded?.author?.name || ''
        data['task.responsible'] = detail._embedded?.responsible?.name || ''
        data['task.customField20'] = detail._links?.customField20?.title || ''
        data['task.customField62'] = detail._links?.customField62?.title || ''
        data['task.customField106'] = detail._links?.customField106?.title || ''
      }
      return data
    }

    const globalData: Record<string, string> = {
      month: String(now.getMonth() + 1),
      year: String(now.getFullYear()),
      handlerName: handlerName || '',
    }

    // #endregion

    // #region 占位符替换

    function replacePlaceholders(cellValue: string, data: Record<string, string>): string {
      return cellValue.replace(PLACEHOLDER_RE, (_match, key) => {
        const k = key.trim()
        return data[k] ?? ''
      })
    }

    // #endregion

    // #region 处理任务行

    if (taskTemplateRows.length > 0 && taskCount > 0) {
      const templateRowCount = taskTemplateRows.length
      const firstTemplateRow = taskTemplateRows[0]

      const templateRowsData: Array<{ styles: Record<number, any>; values: Record<number, string> }> = []
      for (const rowNum of taskTemplateRows) {
        const row = ws.getRow(rowNum)
        const styles: Record<number, any> = {}
        const values: Record<number, string> = {}
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          styles[colNumber] = { ...cell.style }
          values[colNumber] = String(cell.value || '')
        })
        templateRowsData.push({ styles, values })
      }

      const rowsToInsert = (taskCount - 1) * templateRowCount
      if (rowsToInsert > 0) {
        ws.spliceRows(firstTemplateRow, 0, ...Array.from({ length: rowsToInsert }, () => []))
      }

      for (let i = 0; i < taskCount; i++) {
        const taskData = buildTaskData(tasks[i], i)
        const mergedData = { ...globalData, ...taskData }

        for (let j = 0; j < templateRowCount; j++) {
          const targetRowNum = firstTemplateRow + i * templateRowCount + j
          const targetRow = ws.getRow(targetRowNum)
          const { styles, values } = templateRowsData[j]

          for (const colStr of Object.keys(styles)) {
            const col = Number(colStr)
            const cell = targetRow.getCell(col)
            cell.style = styles[col]
            cell.value = replacePlaceholders(values[col], mergedData)
          }
        }
      }

      // 原始模板行由填充循环覆盖是有意为之，不要删除它，也不要删除其下方行，否则会误删合计行等模板内容
    } else if (taskCount === 0) {
      // 无任务时删除模板任务行
      for (let r = taskTemplateRows.length - 1; r >= 0; r--) {
        ws.spliceRows(taskTemplateRows[r], 1)
      }
    }

    // #endregion

    // #region 清理空白行

    // 清理任务数据行与合计行之间的空白预留行，避免导出文件出现大量空白行
    if (taskCount > 0 && summaryRows.length > 0 && taskTemplateRows.length > 0) {
      const templateRowCount = taskTemplateRows.length
      const firstTemplateRow = taskTemplateRows[0]
      // 合计行已随任务区插入下移
      const firstSummaryRow = summaryRows[0] + (taskCount - 1) * templateRowCount
      const lastDataRow = firstTemplateRow + taskCount * templateRowCount - 1
      for (let r = firstSummaryRow - 1; r > lastDataRow; r--) {
        const row = ws.getRow(r)
        let hasValue = false
        row.eachCell({ includeEmpty: false }, (cell) => {
          const val = cell.value
          if (val !== null && val !== undefined && String(val).trim() !== '') hasValue = true
        })
        if (!hasValue) ws.spliceRows(r, 1)
      }
    }

    // #endregion

    // #region 计算合计

    const numericFields = ['score', 'estimatedHours', 'customField1', 'customField105', 'customField107']
    const summaryData: Record<string, string> = { 'summary.count': String(taskCount) }
    for (const field of numericFields) {
      let sum = 0
      for (const task of tasks) {
        let val: number
        if (field === 'score') {
          val = parseFloat(task.rawScore)
        } else if (field === 'estimatedHours') {
          // 合计的 estimatedHours 用本地自评预估工时，与任务行一致
          val = parseFloat(task.rawEstimatedHours)
        } else {
          const taskId = extractWpId(task.rawUrl) || ''
          val = parseFloat(String(apiCache[taskId]?.[field] ?? 0))
        }
        if (!isNaN(val)) sum += val
      }
      summaryData[`summary.${field}`] = String(Math.round(sum * 100) / 100)
    }

    // #endregion

    // #region 替换合计占位符

    ws.eachRow((row) => {
      row.eachCell((cell) => {
        const val = String(cell.value || '')
        if (val.includes('{{')) {
          const allData = { ...globalData, ...summaryData }
          cell.value = replacePlaceholders(val, allData)
        }
      })
    })

    // #endregion

    await wb.xlsx.writeFile(targetPath)
    return { success: true, filePath: targetPath }
  })

  // #endregion
}

// #endregion
