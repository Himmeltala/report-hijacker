/*
 * @Author: zhengrenfu
 * @Date: 2026-08-05 23:24:32
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-05 12:14:04
 * @FilePath: \src\utils\apiUrl.ts
 * @Description: API 基础地址规范化，主进程与渲染进程共用
 */

// #region URL 规范化

/**
 * 规范化 API 基础地址：剥离 OpenProject API 路径后缀，保留站点根（含子路径）
 * 示例：'https://xmgl.cdrunnet.com/api/v3/work_packages' 规范化为 'https://xmgl.cdrunnet.com'
 *       'https://host/openproject' 保留子路径 'https://host/openproject'
 * 请求路径统一以 /api/v3/ 开头，拼接后即可命中正确的站点根
 * @param {string} raw 用户配置的 API 基础地址
 * @returns {string} 规范化后的站点根地址，空值原样返回
 */
export function normalizeApiBaseUrl(raw: string): string {
  if (!raw) return raw
  const trimmed = raw.trim().replace(/\/+$/, '')
  // 已带 /api/vN 前缀的，剥离到站点根（兼容旧默认值 https://host/api/v3/work_packages）
  const apiIdx = trimmed.search(/\/api\/v\d+/i)
  return apiIdx > 0 ? trimmed.slice(0, apiIdx) : trimmed
}

// #endregion
