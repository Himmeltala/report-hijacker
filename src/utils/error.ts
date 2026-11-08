/*
 * @Author: zhengrenfu
 * @Date: 2026-11-08 18:00:00
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-08 18:00:00
 * @FilePath: \src\utils\error.ts
 * @Description: 异常信息提取工具
 */

// #region 异常信息

/**
 * 取出异常的可读信息，等价于 `e?.message || fallback`
 * @param {unknown} e 捕获到的异常，类型未知，可能来自 IPC、fetch 或第三方库
 * @param {string} fallback 取不到非空 message 时返回的兜底文案
 * @returns {string} 可读的异常信息
 */
export function getErrorMessage(e: unknown, fallback = ''): string {
  const message = (e as { message?: unknown } | null | undefined)?.message
  if (typeof message === 'string' && message) return message
  return fallback
}

// #endregion
