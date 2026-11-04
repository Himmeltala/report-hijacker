/*
 * @Author: zhengrenfu
 * @Date: 2026-08-04
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04
 * @FilePath: \electron\services\apiClient.ts
 * @Description: OpenProject API 客户端，提供带 Cookie 鉴权的 GET / POST 请求
 */

import { normalizeApiBaseUrl } from '@/utils/apiUrl'

// #region 类型定义

export interface ApiClient {
  get<T = any>(path: string, cookie: string): Promise<T>
  post<T = any>(path: string, cookie: string, body?: any): Promise<T>
}

// #endregion

// #region 常量

/** 单次请求的超时时间（毫秒），平台不可达时避免界面永久挂起 */
const REQUEST_TIMEOUT = 15000

// #endregion

// #region 客户端工厂

/**
 * 创建 OpenProject API 客户端
 * 每次请求读取 baseUrl（不缓存），避免档案或设置切换后请求打到旧地址
 * @param {() => string} getBaseUrl 获取 API 基础地址的回调
 * @returns {ApiClient} API 客户端对象
 */
export function createApiClient(getBaseUrl: () => string): ApiClient {
  const resolveBaseUrl = (): string => {
    // 规范化后保留子路径
    return normalizeApiBaseUrl(getBaseUrl())
  }

  return {
    /**
     * 发送 GET 请求
     * @param {string} path 请求路径（含 /api/v3 前缀）
     * @param {string} cookie 登录 Cookie
     */
    async get<T = any>(path: string, cookie: string): Promise<T> {
      const res = await fetch(`${resolveBaseUrl()}${path}`, {
        headers: { Cookie: cookie, 'X-Requested-With': 'XMLHttpRequest' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      try {
        return await res.json()
      } catch {
        throw new Error(`响应解析失败 HTTP ${res.status}`)
      }
    },

    /**
     * 发送 POST 请求
     * @param {string} path 请求路径
     * @param {string} cookie 登录 Cookie
     * @param {any} body 请求体
     * @returns {Promise<T>} 响应 JSON 或成功状态
     */
    async post<T = any>(path: string, cookie: string, body?: any): Promise<T> {
      const headers: Record<string, string> = {
        Cookie: cookie,
        'X-Requested-With': 'XMLHttpRequest',
      }
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json'
      }
      const res = await fetch(`${resolveBaseUrl()}${path}`, {
        method: 'POST',
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      // 处理空响应（含 204 No Content）
      const text = await res.text()
      if (!text || text.trim() === '') {
        return { success: true } as T
      }

      try {
        return JSON.parse(text)
      } catch {
        // 非 JSON 响应，返回成功状态
        return { success: true } as T
      }
    },
  }
}

// #endregion
