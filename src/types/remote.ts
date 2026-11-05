/*
 * @Author: zhengrenfu
 * @Date: 2026-08-05 23:34:33
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-05 12:14:04
 * @FilePath: \src\types\remote.ts
 * @Description: 远程 API 原始数据只读类型，保护平台返回数据不被业务代码修改
 */

// #region 工具类型

/**
 * 深度只读工具类型：递归将对象所有属性变为 readonly，编译期禁止写入原始远程数据
 */
export type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K]
}

// #endregion

// #region 工作包类型

/**
 * OpenProject work_package 原始响应，仅声明消费到的字段
 * [key: string]: any 兜底未声明字段，DeepReadonly 包裹后所有字段只读
 */
export interface RawWorkPackage {
  id: number
  subject: string
  description?: {
    raw: string
    format?: string
    html?: string
  }
  startDate?: string
  dueDate?: string
  estimatedTime?: string
  duration?: string
  percentageDone?: number
  createdAt?: string
  updatedAt?: string
  customField1?: number
  customField105?: number
  customField107?: number
  _embedded?: {
    status?: { name: string }
    type?: { name: string }
    project?: { name: string }
    responsible?: { name: string }
    author?: { name: string }
    priority?: { name: string }
    [key: string]: any
  }
  _links?: Record<string, any>
  [key: string]: any
}

/** 只读 work_package：所有层级属性均不可写 */
export type ReadonlyRawWorkPackage = DeepReadonly<RawWorkPackage>

// #endregion
