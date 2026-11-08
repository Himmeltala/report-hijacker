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
              '@schedules': resolve(import.meta.dirname, 'schedules'),
            },
          },
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              // nodemailer 依赖 Node 内置模块与动态 require，交给运行时解析，不打进产物
              external: ['electron', 'nodemailer'],
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
              '@schedules': resolve(import.meta.dirname, 'schedules'),
            },
          },
          build: {
            outDir: 'dist-electron',
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
      '@schedules': resolve(import.meta.dirname, 'schedules'),
    },
  },
  build: {
    outDir: 'dist',
  },
})
