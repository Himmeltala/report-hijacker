/*
 * @Author: zhengrenfu
 * @Date: 2026-07-15
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-09-24
 * @FilePath: \scripts\clean-out.js
 * 描述: 删除打包产物目录（项目内的 out 与安装包输出目录），处理文件锁定问题（重试、重命名策略）
 */

import { existsSync, rmSync, renameSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

// out 是 electron-builder 的输出目录，见 electron-builder.yml 的 directories.output
const TARGETS = ['out']
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

/**
 * 带重试和重命名回退策略的目录删除
 * @param {string} dirPath 目标目录
 * @returns {boolean} 是否成功删除
 */
function forceRemove(dirPath) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      rmSync(dirPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 })
      return true
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        // 重命名策略：锁有时只阻止删除，不阻止重命名
        try {
          const tmp = resolve(tmpdir(), `out_${randomUUID()}`)
          renameSync(dirPath, tmp)
          rmSync(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 })
          return true
        } catch {
          console.warn(`[clean-out] 第 ${attempt} 次尝试失败，${RETRY_DELAY_MS / 1000}s 后重试...`)
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RETRY_DELAY_MS)
        }
      }
    }
  }
  return false
}

let failed = false

for (const target of TARGETS) {
  const dirPath = resolve(target)

  if (!existsSync(dirPath)) {
    console.log(`[clean-out] ${target} 目录不存在，跳过清理`)
    continue
  }

  console.log(`[clean-out] 删除 ${target} 目录...`)

  if (forceRemove(dirPath)) {
    console.log(`[clean-out] ${target} 删除成功`)
    continue
  }

  failed = true
  // 最后手段：列出锁定的文件
  console.error(`[clean-out] 无法删除 ${target} 目录，可能被以下程序占用：`)
  console.error(`  - 文件资源管理器打开了 ${target} 目录`)
  console.error('  - 上一次打包的 TaskManager.exe 仍在运行')
  console.error('  - 杀毒软件正在扫描')
  console.error('')
  console.error('请关掉上述程序后重试，或用 handle64.exe 查找锁定进程：')
  console.error(`  handle64.exe ${target} /accepteula`)
}

process.exit(failed ? 1 : 0)
