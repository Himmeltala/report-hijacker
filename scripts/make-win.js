/*
 * 描述: 打包 Windows 安装包。先用 vite 构建，再用 electron-builder 出向导式 NSIS 安装包（所有用户安装），
 *      最后核对产物是否真的生成。取代原来的 electron-forge + Squirrel 链路。
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MIRROR } from './install-electron.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'out')

// electron-builder 的二进制（nsis、winCodeSign、7zip 等）默认从 GitHub 下载，当前网络不可达
const BINARIES_MIRROR =
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR || 'https://cdn.npmmirror.com/binaries/electron-builder-binaries/'

// 构建产物，缺任何一个都不该继续打包，否则会打出装不上东西的安装包
const REQUIRED_BUILD_OUTPUT = ['dist/index.html', 'dist-electron/main.js', 'dist-electron/preload.cjs']

// ${version} 由 electron-builder 替换成 package.json 里的版本号
const ARTIFACT_NAME = 'report-hijacker-${version}-setup.exe'

/**
 * 执行子命令，失败即中断
 * @param {string} command 命令
 * @param {string[]} args 参数列表
 * @param {string} label 日志前缀
 */
function run(command, args, label) {
  console.log(`[make-win] ${label}: ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: ROOT,
    // Windows 上命令是 .cmd 垫片，需要 shell 才能解析
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      ELECTRON_MIRROR: MIRROR,
      ELECTRON_BUILDER_BINARIES_MIRROR: BINARIES_MIRROR,
    },
  })
  if (result.status !== 0) {
    console.error(`[make-win] ${label} 失败，退出码 ${result.status ?? '未取到'}`)
    process.exit(result.status ?? 1)
  }
}

function assertBuildOutput() {
  const missing = REQUIRED_BUILD_OUTPUT.filter((rel) => !existsSync(join(ROOT, rel)))
  if (missing.length > 0) {
    console.error(`[make-win] 缺少构建产物: ${missing.join('、')}`)
    process.exit(1)
  }
}

function main() {
  const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
  const artifactName = ARTIFACT_NAME.replace('${version}', version)

  console.log(`[make-win] Electron 镜像: ${MIRROR}`)
  console.log(`[make-win] builder 二进制镜像: ${BINARIES_MIRROR}`)

  run(process.execPath, [join(ROOT, 'scripts', 'clean-out.js')], '清理产物目录')
  run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['run', 'build'], '构建应用')
  assertBuildOutput()

  run(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['exec', 'electron-builder', '--win', '--x64', '--publish', 'never', `-c.nsis.artifactName=${artifactName}`],
    '打包安装包',
  )

  const artifactPath = join(OUT_DIR, artifactName)
  if (!existsSync(artifactPath)) {
    console.error(`[make-win] 没找到安装包产物: ${artifactPath}`)
    process.exit(1)
  }
  const mb = (statSync(artifactPath).size / 1024 / 1024).toFixed(1)
  console.log(`[make-win] 安装包: ${artifactPath}（${mb} MB）`)
}

main()
