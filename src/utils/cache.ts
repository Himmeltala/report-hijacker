/*
 * @Author: zhengrenfu
 * @Date: 2026-07-16 21:36:19
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-07-16 12:14:04
 * @FilePath: \src\utils\cache.ts
 * @Description: 内存缓存工具，支持 TTL 过期
 */

// #region 缓存存储

const store = new Map<string, { data: any; expireAt: number }>()

// #endregion

// #region 缓存操作

/**
 * 读取缓存
 * @param key 缓存键
 * @returns 缓存数据，过期或不存在返回 null
 */
export function getCache<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() > entry.expireAt) {
    store.delete(key)
    return null
  }
  return entry.data as T
}

/**
 * 写入缓存
 * @param key 缓存键
 * @param data 数据
 * @param ttlMs 过期时间（毫秒），默认 30 分钟
 */
export function setCache<T>(key: string, data: T, ttlMs = 30 * 60 * 1000): void {
  store.set(key, { data, expireAt: Date.now() + ttlMs })
}

export function removeCache(key: string): void {
  store.delete(key)
}

export function clearAllCache(): void {
  store.clear()
}

// #endregion
