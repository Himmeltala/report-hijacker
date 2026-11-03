/*
 * @Author: zhengrenfu
 * @Date: 2026-07-14 21:36:18
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-07-14 10:02:02
 * @FilePath: \..\\src\\env.d.ts
 * @Description: 描述
 */

/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
