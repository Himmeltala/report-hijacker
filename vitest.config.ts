/*
 * @Author: zhengrenfu
 * @Date: 2026-11-08
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-08 19:30:00
 * @FilePath: \vitest.config.ts
 * @Description: 单元测试配置，测试代码统一放在 tests 目录，不进入应用构建
 */
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@electron': resolve(import.meta.dirname, 'electron'),
      '@schedules': resolve(import.meta.dirname, 'schedules'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
