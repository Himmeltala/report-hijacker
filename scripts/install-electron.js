/*
 * @Author: zhengrenfu
 * @Date: 2026-09-24
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-09 09:55:00
 * @FilePath: \scripts\install-electron.js
 * @Description: 安装 Electron 二进制，下载源统一走国内镜像；已解压出对应版本时直接跳过，避免重复安装白等
 */

import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ELECTRON_DIR = join(ROOT, 'node_modules', 'electron')
const DIST_DIR = join(ELECTRON_DIR, 'dist')

export const MIRROR = process.env.ELECTRON_MIRROR || 'https://cdn.npmmirror.com/binaries/electron/'

// 解压好的二进制版本号，未解压或版本对不上时返回 undefined
function installedVersion() {
  try {
    return readFileSync(join(DIST_DIR, 'version'), 'utf8').trim()
  } catch {
    return undefined
  }
}

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

  // 已经解压出对应版本就不再跑 install.js：它每次都要读一遍 140 MB 的缓存包校验，
  // 重复安装时纯属白等。版本对不上（例如升级了 electron）才重新解压。
  const expected = JSON.parse(readFileSync(join(ELECTRON_DIR, 'package.json'), 'utf8')).version
  if (installedVersion() === expected) {
    console.log(`[install-electron] Electron ${expected} 二进制已就绪，跳过`)
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
