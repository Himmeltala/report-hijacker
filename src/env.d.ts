/*
 * @Author: zhengrenfu
 * @Date: 2026-10-17 20:14:10
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-05 10:19:21
 * @FilePath: /pros/self/task-manager/src/env.d.ts
 * @Description: 描述
 */

/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
