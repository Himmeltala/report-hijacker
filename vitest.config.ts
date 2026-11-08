import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// 单元测试独立配置：不加载 electron 插件，只解析路径别名
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
    include: ['src/**/*.test.ts', 'electron/**/*.test.ts'],
  },
})
