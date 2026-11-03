/*
 * @Author: zhengrenfu
 * @Date: 2026-08-04
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04
 * @FilePath: \electron\services\validationService.ts
 * @Description: 任务校验与评论区检查 IPC
 */

import { ipcMain } from 'electron'
import type { ApiClient } from '@electron/services/apiClient'
import type { AppSettings } from '@electron/services/settingsService'
import { extractWpId, readJsonFile } from '@electron/utils'
import { validateWorkPackage, type WorkPackageExpectations } from '@/services/validationRules'

// #region IPC 注册

/**
 * 注册任务校验与评论区检查 IPC
 * @param {object} api API 客户端
 * @param {object} deps 依赖项
 * @param {() => AppSettings} deps.getSettings 获取当前设置实例（「设置值」来源按 schema 注入配置值）
 */
export function setupValidationIpc(api: ApiClient, deps: { getSettings: () => AppSettings }): void {
  const { getSettings } = deps

  // #region 任务校验

  ipcMain.handle('api:validateTask', async (_e, params) => {
    const {
      rawSeq,
      rawProjectName,
      rawTitle,
      rawScore,
      rawEstimatedHours,
      rawRemark,
      rawUrl,
      cookie,
      checkRules,
      boundaryRules,
      boundaryMatchMode,
      taskDate,
    } = params
    const taskId = extractWpId(rawUrl) || ''
    const result: any = {
      serTaskId: taskId,
      serValid: false,
      rawProjectName,
      rawTitle,
      serChecks: [],
    }

    if (!taskId) {
      result.serChecks.push({ name: '任务ID', passed: false, message: '无法从链接提取任务ID' })
      return result
    }

    let detail: any
    try {
      detail = await api.get(`/api/v3/work_packages/${taskId}`, cookie)
    } catch (e: any) {
      result.serError = `获取任务详情失败: ${e.message}`
      result.serChecks.push({ name: 'API请求', passed: false, message: result.serError })
      return result
    }

    // 校验规则由共享纯函数模块执行，主进程只负责取数和透传
    // 「设置值」来源的规则按设置键取预期值：把 schema 中 compareCandidate 设置项的值
    // 以完整设置键为属性名注入 exp，引擎 resolveExpected 按 expectedKey 直接取值
    const exp: WorkPackageExpectations & Record<string, any> = {
      taskId,
      rawSeq,
      rawProjectName,
      rawTitle,
      rawScore,
      rawEstimatedHours,
      rawRemark,
      checkRules: checkRules || [],
      boundaryRules: boundaryRules || [],
      boundaryMatchMode: boundaryMatchMode || 'any',
      taskDate,
    }
    const schema: any[] = readJsonFile(getSettings().getSchemaPath(), [])
    for (const cat of schema) {
      for (const group of cat.groups || []) {
        for (const setting of group.settings || []) {
          if (setting.compareCandidate === true) {
            exp[setting.key] = getSettings().get(setting.key) ?? ''
          }
        }
      }
    }
    const validation = validateWorkPackage(detail, exp)
    result.serChecks = validation.serChecks
    result.serValid = validation.serValid
    result.serBoundaryResults = validation.serBoundaryResults
    result.serBoundaryMatchMode = validation.serBoundaryMatchMode
    // 透传完整原始 API 响应，消费端直接导航 subject / _embedded.status.name / _links.type.title 等
    result.remote = detail
    return result
  })

  // #endregion

  // #region 评论区检查

  ipcMain.handle('api:checkComments', async (_e, params) => {
    const { taskId, cookie } = params
    if (!taskId || !cookie) throw new Error('缺少 taskId 或 cookie')

    try {
      // 透传完整原始 API 响应，消费端直接导航 _embedded.elements[]._type / comment.raw
      return await api.get(`/api/v3/work_packages/${taskId}/activities`, cookie)
    } catch (e: any) {
      // 404 表示任务无活动记录，返回空数据供消费端继续走匹配流程
      if (String(e.message).includes('404')) {
        return { _type: 'Collection', total: 0, count: 0, _embedded: { elements: [] }, _links: {} }
      }
      throw e
    }
  })

  // #endregion
}

// #endregion
