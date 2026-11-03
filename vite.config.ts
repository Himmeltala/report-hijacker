import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart(args) {
          // 传递 --ozone-platform=x11 和 --disable-gpu 给 electron 进程
          // 解决 VMware 虚拟机 + Wayland 下窗口不可见的问题
          if (process.platform === 'linux') {
            args.startup(['.', '--no-sandbox', '--ozone-platform=x11', '--disable-gpu'])
          } else {
            args.startup()
          }
        },
        vite: {
          resolve: {
            alias: {
              '@': resolve(import.meta.dirname, 'src'),
              '@electron': resolve(import.meta.dirname, 'electron'),
            },
          },
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          resolve: {
            alias: {
              '@': resolve(import.meta.dirname, 'src'),
              '@electron': resolve(import.meta.dirname, 'electron'),
            },
          },
          build: {
            outDir: 'dist-electron',
            // Electron 28 起 preload 的加载方式遵循 package.json 的 type 字段，
            // 项目声明了 type: module，若输出 .js 会被当作 ESM 解析导致 require 报错。
            // 改用 .cjs 扩展名强制按 CommonJS 加载，与 package.json 的 type 无关
            lib: {
              formats: ['cjs'],
              fileName: () => '[name].cjs',
            },
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
      '@electron': resolve(import.meta.dirname, 'electron'),
    },
  },
  build: {
    outDir: 'dist',
  },
})
