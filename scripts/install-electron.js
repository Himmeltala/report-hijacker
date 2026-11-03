/*
 * @Author: zhengrenfu
 * @Date: 2026-09-24
 * @FilePath: \scripts\install-electron.js
 * 描述: 安装 Electron 二进制。electron 42 起不再声明 postinstall 脚本，二进制改由首次 require 时按需下载，
 *      下载源默认指向 GitHub，当前网络不可达；pnpm 又不读取 package.json 的 config 字段，
 *      因此这里统一设置 ELECTRON_MIRROR 为国内镜像，安装与打包链路都从这里取镜像地址。
 */

import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ELECTRON_DIR = join(ROOT, 'node_modules', 'electron')

export const MIRROR = process.env.ELECTRON_MIRROR || 'https://cdn.npmmirror.com/binaries/electron/'

// 只在作为脚本直接运行时执行安装，被其他脚本导入时仅取镜像地址
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!existsSync(ELECTRON_DIR)) {
    console.log('[install-electron] 未安装 electron 依赖，跳过二进制下载')
    process.exit(0)
  }

  if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD === '1') {
    console.log('[install-electron] 已设置 ELECTRON_SKIP_BINARY_DOWNLOAD，跳过二进制下载')
    process.exit(0)
  }

  console.log(`[install-electron] 使用镜像 ${MIRROR}`)
  const result = spawnSync(process.execPath, [join(ELECTRON_DIR, 'install.js')], {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_MIRROR: MIRROR },
  })

  if (result.status !== 0) {
    console.error('[install-electron] Electron 二进制下载失败，请检查镜像地址是否可用')
    process.exit(result.status ?? 1)
  }
}
