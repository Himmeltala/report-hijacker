/*
 * @Author: Himmeltala
 * @Date: 2026-11-05 09:12:08
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-06 23:15:00
 * @FilePath: \server\update-server.mjs
 * @Description: 更新服务：扫描安装包目录，提供更新源文件与检查接口
 */

import { createHash } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { basename, dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SERVER_DIR = dirname(fileURLToPath(import.meta.url))
const LISTEN_PORT = Number(process.env.UPDATE_SERVER_PORT) || 3000
const LISTEN_HOST = process.env.UPDATE_SERVER_HOST || '0.0.0.0'
const PACKAGE_DIR = resolve(process.env.UPDATE_PACKAGE_DIR || join(SERVER_DIR, 'packages'))
const PUBLIC_BASE_URL = String(process.env.UPDATE_PUBLIC_BASE_URL || '').replace(/\/+$/, '')
const VERSION_OVERRIDE = String(process.env.UPDATE_VERSION || '').trim()
const CHECK_NOTES = String(process.env.UPDATE_NOTES || '').trim()

const CHECK_PATH = '/api/update/check'
const DOWNLOAD_PREFIX = '/api/update/download/'
const VERSION_PATTERN = /(\d+\.\d+\.\d+(?:\.\d+)?)/

// MD5 缓存，文件修改时间与大小不变时直接复用
const md5Cache = new Map()

// 找出修改时间最新的 exe 安装包
function findLatestInstaller() {
  let latest = null
  for (const entry of readdirSync(PACKAGE_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.exe') continue
    const filePath = join(PACKAGE_DIR, entry.name)
    try {
      const info = statSync(filePath)
      if (!latest || info.mtimeMs > latest.mtimeMs) {
        latest = { filePath, fileName: entry.name, size: info.size, mtimeMs: info.mtimeMs }
      }
    } catch {
      // 单个文件读不到时跳过，不影响其他候选
    }
  }
  return latest
}

// 计算文件 MD5，按修改时间与大小命中缓存
function md5File(filePath, mtimeMs, size) {
  const cached = md5Cache.get(filePath)
  if (cached && cached.mtimeMs === mtimeMs && cached.size === size) return Promise.resolve(cached.md5)
  return new Promise((resolvePromise, reject) => {
    const hash = createHash('md5')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => {
      const md5 = hash.digest('hex')
      md5Cache.set(filePath, { mtimeMs, size, md5 })
      resolvePromise(md5)
    })
  })
}

// 从文件名解析版本号
function parseVersion(fileName) {
  const matched = VERSION_PATTERN.exec(fileName)
  return matched ? matched[1] : ''
}

// 按请求头拼出对外的服务地址，也支持用环境变量固定
function publicBaseUrl(req) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL
  const host = req.headers.host || `127.0.0.1:${LISTEN_PORT}`
  const proto = String(req.headers['x-forwarded-proto'] || 'http')
    .split(',')[0]
    .trim()
  return `${proto}://${host}`
}

// 生成更新接口的返回内容
async function buildUpdateInfo(req) {
  const installer = findLatestInstaller()
  if (!installer) throw new Error(`安装包目录里没有 exe 文件: ${PACKAGE_DIR}`)
  const version = VERSION_OVERRIDE || parseVersion(installer.fileName)
  if (!version) throw new Error(`安装包文件名里没有版本号，请改名或设置 UPDATE_VERSION: ${installer.fileName}`)
  const md5 = await md5File(installer.filePath, installer.mtimeMs, installer.size)
  return {
    version,
    url: `${publicBaseUrl(req)}${DOWNLOAD_PREFIX}${encodeURIComponent(installer.fileName)}`,
    md5,
    size: installer.size,
    notes: CHECK_NOTES || `测试更新包 ${installer.fileName}`,
    file: installer.fileName,
  }
}

// 响应 JSON
function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data, null, 2)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

// 转义页面里展示的动态文本
function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// 首页，方便用浏览器确认服务与当前安装包
function sendStatusPage(res, info, error) {
  const detail = info
    ? `<dl>
        <dt>版本</dt><dd>${escapeHtml(info.version)}</dd>
        <dt>安装包</dt><dd>${escapeHtml(info.file)}</dd>
        <dt>大小</dt><dd>${(info.size / 1024 / 1024).toFixed(1)} MB</dd>
        <dt>MD5</dt><dd><code>${escapeHtml(info.md5)}</code></dd>
        <dt>下载地址</dt><dd><a href="${escapeHtml(info.url)}">${escapeHtml(info.url)}</a></dd>
        <dt>更新源</dt><dd><a href="/latest.yml">/latest.yml</a></dd>
      </dl>`
    : `<p class="error">${escapeHtml(error)}</p>`
  const body = `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>任务管理器更新服务</title>
<style>body{font-family:"Microsoft YaHei",Arial,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;line-height:1.7;color:#222}
h1{font-size:20px}dt{float:left;width:88px;color:#666}dd{margin-left:88px;word-break:break-all}code{background:#f3f3f3;padding:1px 4px;border-radius:3px}
.error{color:#c0392b}</style></head>
<body>
<h1>任务管理器更新服务</h1>
<p>安装包目录：<code>${escapeHtml(PACKAGE_DIR)}</code></p>
${detail}
<p>检查接口：<a href="${CHECK_PATH}">${CHECK_PATH}</a></p>
</body>
</html>`
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

// 文件名解码，失败返回空串
function decodeFileName(raw) {
  try {
    return decodeURIComponent(raw)
  } catch {
    return ''
  }
}

// 校验并取回安装包目录下的文件，返回 null 时已响应错误
function openPackageFile(res, fileName) {
  if (!fileName || basename(fileName) !== fileName) {
    sendJson(res, 400, { error: '非法的文件名' })
    return null
  }
  if (!/\.(exe|yml|blockmap)$/i.test(fileName)) {
    sendJson(res, 400, { error: `不支持的文件类型: ${fileName}` })
    return null
  }
  const filePath = resolve(PACKAGE_DIR, fileName)
  if (!filePath.startsWith(PACKAGE_DIR + sep) || !existsSync(filePath)) {
    sendJson(res, 404, { error: `文件不存在: ${fileName}` })
    return null
  }
  const info = statSync(filePath)
  if (!info.isFile()) {
    sendJson(res, 404, { error: `文件不存在: ${fileName}` })
    return null
  }
  return { filePath, info }
}

// 回写文件内容，asDownload 为真时按附件下载
function sendPackageFile(req, res, fileName, asDownload) {
  const file = openPackageFile(res, fileName)
  if (!file) return
  const headers = {
    'Content-Type': /\.yml$/i.test(fileName) ? 'text/yaml; charset=utf-8' : 'application/octet-stream',
    'Content-Length': file.info.size,
    'Cache-Control': 'no-store',
  }
  if (asDownload) {
    headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
  }
  res.writeHead(200, headers)
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  const stream = createReadStream(file.filePath)
  stream.on('error', () => res.destroy())
  stream.pipe(res)
}

const server = createServer(async (req, res) => {
  const method = req.method || 'GET'
  const pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname
  console.log(`[update-server] ${method} ${pathname}`)
  try {
    if (pathname === CHECK_PATH) {
      if (method !== 'GET' && method !== 'HEAD') {
        sendJson(res, 405, { error: '只支持 GET 请求' })
        return
      }
      const info = await buildUpdateInfo(req)
      if (method === 'HEAD') {
        res.writeHead(200, { 'Cache-Control': 'no-store' })
        res.end()
        return
      }
      sendJson(res, 200, info)
      return
    }
    if (pathname.startsWith(DOWNLOAD_PREFIX)) {
      const fileName = decodeFileName(pathname.slice(DOWNLOAD_PREFIX.length))
      if (!fileName) {
        sendJson(res, 400, { error: '安装包文件名编码不正确' })
        return
      }
      sendPackageFile(req, res, fileName, true)
      return
    }
    // 更新源目录：electron-updater 按 latest.yml 里的文件名直取安装包与 blockmap
    const feedFile = decodeFileName(pathname.slice(1))
    if (feedFile && /\.(exe|yml|blockmap)$/i.test(feedFile)) {
      if (method !== 'GET' && method !== 'HEAD') {
        sendJson(res, 405, { error: '只支持 GET 请求' })
        return
      }
      sendPackageFile(req, res, feedFile, false)
      return
    }
    if (pathname === '/' || pathname === '/index.html') {
      try {
        sendStatusPage(res, await buildUpdateInfo(req), '')
      } catch (e) {
        sendStatusPage(res, null, e?.message || '读取安装包失败')
      }
      return
    }
    sendJson(res, 404, { error: `未知路径: ${pathname}` })
  } catch (e) {
    sendJson(res, 500, { error: e?.message || '服务内部错误' })
  }
})

mkdirSync(PACKAGE_DIR, { recursive: true })
server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`[update-server] 监听 http://${LISTEN_HOST}:${LISTEN_PORT}`)
  console.log(`[update-server] 安装包目录: ${PACKAGE_DIR}`)
  console.log(`[update-server] 检查接口: http://${LISTEN_HOST}:${LISTEN_PORT}${CHECK_PATH}`)
  console.log(`[update-server] 更新源: http://${LISTEN_HOST}:${LISTEN_PORT}/latest.yml`)
  const installer = findLatestInstaller()
  console.log(installer ? `[update-server] 当前安装包: ${installer.fileName}` : '[update-server] 安装包目录为空，放入 exe 后即可返回更新')
})
