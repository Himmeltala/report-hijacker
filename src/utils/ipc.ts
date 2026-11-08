/*
 * @Author: zhengrenfu
 * @Date: 2026-09-14 16:00:00
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-09-14 16:00:00
 * @FilePath: \src\utils\ipc.ts
 * @Description: IPC 安全调用层 — 入参净化后再交给 Electron，避免响应式代理触发结构化克隆失败
 */

import { isProxy, toRaw } from 'vue'
import type { IpcApi } from '@/types/ipc'

// #region 入参净化

/**
 * 递归把 Vue 响应式代理转换为可结构化克隆的普通值
 * contextBridge 与 ipcRenderer 只接受普通对象，直接传 reactive 代理会抛克隆错误；函数原样返回（事件订阅依赖函数引用），Map 与 Set 逐项净化，用 WeakMap 记录已访问对象以兼容循环引用
 * @param value 任意待传递值
 * @param seen 已处理对象缓存，递归内部使用
 * @returns 可通过 IPC 传递的纯值副本
 */
export function toPlain<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') return value

  const source = (isProxy(value) ? toRaw(value) : value) as any
  const cached = seen.get(source)
  if (cached !== undefined) return cached as T

  if (source instanceof Date) return new Date(source.getTime()) as T
  if (source instanceof RegExp) return new RegExp(source.source, source.flags) as T
  if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) return source as T

  if (source instanceof Map) {
    const out = new Map<unknown, unknown>()
    seen.set(source, out)
    source.forEach((v: unknown, k: unknown) => out.set(toPlain(k, seen), toPlain(v, seen)))
    return out as T
  }

  if (source instanceof Set) {
    const out = new Set<unknown>()
    seen.set(source, out)
    source.forEach((v: unknown) => out.add(toPlain(v, seen)))
    return out as T
  }

  const out: any = Array.isArray(source) ? [] : {}
  seen.set(source, out)
  for (const key of Object.keys(source)) out[key] = toPlain(source[key], seen)
  return out as T
}

// #endregion

// #region 安全 IPC 代理

/**
 * window.electron 的安全包装：调用前净化全部入参
 * 用法与 window.electron 一致，无 preload 时返回 undefined 保持可选调用语义
 */
export const ipc: IpcApi = new Proxy({} as IpcApi, {
  get(_target, prop: string) {
    const api = window.electron
    if (!api) return undefined
    const fn = api[prop as keyof IpcApi]
    if (typeof fn !== 'function') return fn
    return (...args: unknown[]) =>
      (fn as (...params: unknown[]) => unknown).apply(
        api,
        args.map((arg) => toPlain(arg)),
      )
  },
})

// #endregion
