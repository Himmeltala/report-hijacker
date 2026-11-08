<!--
 * @Author: zhengrenfu
 * @Date: 2026-11-04 15:20:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-06 11:13:00
 * @FilePath: \src\components\MarkdownText.vue
 * @Description: Markdown 渲染组件，用于展示 AI 审查结论，支持 mermaid 流程图与右键导出（导出前净化 SVG 防止画布染污）
-->

<template>
  <div class="markdown-text">
    <div ref="bodyRef" class="markdown-body" v-html="parsed.html" @contextmenu="onContextMenu"></div>
    <Teleport to="body">
      <div v-if="menu.visible" class="mermaid-menu" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }">
        <div class="mermaid-menu-item" @click="copyImage">复制图片</div>
        <div class="mermaid-menu-item" @click="exportPng">导出 PNG</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { marked } from 'marked'
import { ipc } from '@/utils/ipc'
import { getErrorMessage } from '@/utils/error'

const props = defineProps<{
  text?: string | null
}>()

const bodyRef = ref<HTMLElement | null>(null)

// 右键菜单状态，block 记录被右键的流程图容器
const menu = reactive({ visible: false, x: 0, y: 0, block: null as HTMLElement | null })

// mermaid 惰性加载：结论里真有流程图时才拉包，避免拖慢首屏
let mermaidLib: Promise<typeof import('mermaid').default> | null = null
function loadMermaid() {
  if (!mermaidLib) {
    mermaidLib = import('mermaid').then((m) => {
      // suppressErrorRendering 让语法错误直接抛出，由本组件退回源码展示，不在页面上画错误图
      m.default.initialize({ startOnLoad: false, suppressErrorRendering: true })
      return m.default
    })
  }
  return mermaidLib
}

// 提取 ```mermaid 围栏换成占位段落；图源在尖括号转义前取出，保住 --> 与 <br/> 语法
function extractMermaid(text: string): { stripped: string; sources: string[] } {
  const sources: string[] = []
  const stripped = text.replace(/```mermaid[^\n]*\n([\s\S]*?)```/g, (_m, code) => {
    sources.push(code.trim())
    return `\n\n@@mmd${sources.length - 1}@@\n\n`
  })
  return { stripped, sources }
}

// 节点文字里的英文括号会被 Mermaid 当成形状语法，任务原文带 close() 这类写法时整张图解析失败；
// 重试前把这类方括号标签改成双引号包裹，数据形状（如 [(库)]）保持原样
function quoteBracketedLabels(src: string): string {
  return src.replace(/([A-Za-z_][\w-]*)\[([^[\]\n]*)\]/g, (m, id: string, label: string) => {
    // 已加引号，或以形状语法开头，都不动
    if (label.startsWith('"') || /^[[(/\\]/.test(label)) return m
    if (!/[()"]/.test(label)) return m
    return `${id}["${label.replace(/"/g, '&quot;')}"]`
  })
}

// 先转义尖括号，避免结论里的原始 HTML 被当成标签渲染；表格外包一层容器，窄列下可横向滚动
const parsed = computed(() => {
  const { stripped, sources } = extractMermaid(props.text || '')
  let html = marked.parse(stripped.replace(/</g, '&lt;'), { async: false, gfm: true, breaks: true })
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>')
  // 占位段落换成流程图容器；围栏紧跟「建议：」时占位会留在段落里，再兜底替换一次保证图不丢
  html = html.replace(/<p>@@mmd(\d+)@@<\/p>/g, (_m, i) => `<div class="mermaid-block" data-idx="${i}"></div>`)
  html = html.replace(/@@mmd(\d+)@@/g, (_m, i) => `<div class="mermaid-block" data-idx="${i}"></div>`)
  return { html, sources }
})

// 渲染序号令牌，文本连续变化时丢弃过期的渲染任务
let renderToken = 0

async function renderMermaid() {
  const root = bodyRef.value
  if (!root) return
  const token = ++renderToken
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('.mermaid-block'))
  if (!blocks.length) return
  const mermaid = await loadMermaid()
  if (token !== renderToken) return
  for (const block of blocks) {
    if (block.dataset.rendered === '1') continue
    const src = parsed.value.sources[Number(block.dataset.idx)]
    if (!src) continue
    block.dataset.rendered = '1'
    // id 必须文档级唯一，多行结论同时渲染时不能撞
    const id = `mmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    try {
      const { svg } = await mermaid.render(id, src)
      if (!block.isConnected) continue
      block.innerHTML = svg
    } catch {
      const quoted = quoteBracketedLabels(src)
      // 括号问题才值得重试，其他语法错误直接退回源码展示
      if (quoted !== src) {
        try {
          const { svg } = await mermaid.render(`${id}-q`, quoted)
          if (!block.isConnected) continue
          block.innerHTML = svg
          continue
        } catch {
          // 加引号仍解析失败，落到下面的源码展示
        }
      }
      // 图源语法错误时退回源码展示，保证结论仍可读
      block.classList.add('mermaid-failed')
      block.textContent = src
    }
  }
}

function onContextMenu(e: MouseEvent) {
  const block = (e.target as Element).closest('.mermaid-block') as HTMLElement | null
  if (!block || !block.querySelector('svg')) {
    closeMenu()
    return
  }
  e.preventDefault()
  menu.block = block
  // 靠近右边缘与下边缘时翻转，避免菜单被裁掉
  menu.x = Math.min(e.clientX, window.innerWidth - 160)
  menu.y = Math.min(e.clientY, window.innerHeight - 90)
  menu.visible = true
}

function closeMenu() {
  menu.visible = false
  menu.block = null
}

function onDocContextMenu(e: MouseEvent) {
  // 组件内右键流程图由 onContextMenu 处理，菜单自身右键不关
  if ((e.target as Element).closest?.('.mermaid-menu, .mermaid-block')) return
  closeMenu()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeMenu()
}

watch(
  () => menu.visible,
  (open) => {
    if (open) {
      document.addEventListener('click', closeMenu)
      document.addEventListener('contextmenu', onDocContextMenu)
      document.addEventListener('keydown', onKeydown)
    } else {
      document.removeEventListener('click', closeMenu)
      document.removeEventListener('contextmenu', onDocContextMenu)
      document.removeEventListener('keydown', onKeydown)
    }
  },
)

// 净化序列化后的 SVG，去掉会导致 canvas 染污（Tainted canvases）的外部资源引用
// Chromium 规则：SVG 图片只要包含外部引用（http/https 地址），drawImage 后就视为跨源，toBlob 会被拒绝
function sanitizeSvgForPng(svg: string): string {
  return (
    svg
      // 外部 <image> 元素整体移除
      .replace(/<image\b[^>]*\/?\s*>/gi, '')
      // 外部 <link> 引用整体移除
      .replace(/<link\b[^>]*\/?\s*>/gi, '')
      // 样式里的 @import 外部样式表移除
      .replace(/@import\s[^;]+;/gi, '')
      // 样式里的 url(外部地址) 置空，保留 url() 占位不破坏 CSS 语法；data: 与 # 片段引用不受影响
      .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q: string, url: string) =>
        /^https?:|^\/\//i.test(url.trim()) ? 'url()' : m,
      )
      // href / xlink:href / src 指向外部地址的置空；# 片段引用（箭头 marker 等）与 data: 图片保留
      .replace(/(\s(?:xlink:)?href\s*=\s*)(["'])(?:https?:|\/\/)[^"']*\2/gi, '$1$2$2')
      .replace(/(\s(?:xlink:)?src\s*=\s*)(["'])(?:https?:|\/\/)[^"']*\2/gi, '$1$2$2')
  )
}

// SVG 序列化后经 canvas 转 PNG，2 倍分辨率保证贴回平台后仍清晰
async function svgToPngBlob(svg: SVGSVGElement): Promise<Blob> {
  const rect = svg.getBoundingClientRect()
  const w = Math.max(1, Math.round(rect.width))
  const h = Math.max(1, Math.round(rect.height))
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))
  // mermaid 的内联 max-width 会把导出尺寸压小，去掉后按实际像素出图
  clone.removeAttribute('style')
  const data = sanitizeSvgForPng(new XMLSerializer().serializeToString(clone))
  // 用 data URL 加载 SVG，避免 file:// 页面下 blob URL 图片被当跨源导致画布染污
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data)
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('SVG 解析失败'))
    img.src = url
  })
  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = w * scale
  canvas.height = h * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画布创建失败')
  // mermaid 默认透明底，铺白底后贴回平台更清楚
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0, w, h)
  return await new Promise<Blob>((resolve, reject) => {
    // 染污的画布 toBlob 回调返回 null（控制台报 Tainted canvases may not be exported）
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('SVG 转 PNG 失败（图内含外部资源，画布被染污）'))),
      'image/png',
    )
  })
}

// 取被右键流程图的 mermaid 源码，转 PNG 失败时兜底复制用
function mermaidSourceOf(block: HTMLElement): string {
  if (block.dataset.idx === undefined) return ''
  return parsed.value.sources[Number(block.dataset.idx)] || ''
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function copyImage() {
  const block = menu.block
  closeMenu()
  if (!block) return
  try {
    const svg = block.querySelector('svg')
    if (!svg) return
    const dataBase64 = await blobToBase64(await svgToPngBlob(svg as SVGSVGElement))
    await ipc.copyImagePng({ dataBase64 })
    ElMessage.success('流程图已复制到剪贴板')
  } catch (e) {
    // 转 PNG 失败时兜底复制 mermaid 源码，保证仍能把图带到其他地方
    const source = mermaidSourceOf(block)
    if (source) {
      try {
        await ipc.copyText({ text: source })
        ElMessage.warning('图片复制失败，已把 mermaid 源码复制到剪贴板')
        return
      } catch {
        // 兜底也失败时落到下面的统一报错
      }
    }
    ElMessage.error('复制流程图失败：' + getErrorMessage(e, String(e)))
  }
}

async function exportPng() {
  const block = menu.block
  closeMenu()
  if (!block) return
  try {
    const svg = block.querySelector('svg')
    if (!svg) return
    const dataBase64 = await blobToBase64(await svgToPngBlob(svg as SVGSVGElement))
    const path = await ipc.saveFile({
      defaultName: '流程图.png',
      filters: [{ name: 'PNG 图片', extensions: ['png'] }],
    })
    if (!path) return
    await ipc.writeBinaryFile({ filePath: path, dataBase64 })
    ElMessage.success('已导出 ' + path)
  } catch (e) {
    // 转 PNG 失败（如画布染污）时兜底导出 SVG 文件
    try {
      // svg 变量声明在上方 try 块内，这里从 block 重新取
      const svgEl = block.querySelector('svg')
      if (!svgEl) throw new Error('未找到流程图 SVG 节点')
      const path = await ipc.saveFile({
        defaultName: '流程图.svg',
        filters: [{ name: 'SVG 图片', extensions: ['svg'] }],
      })
      if (!path) return
      const data = sanitizeSvgForPng(new XMLSerializer().serializeToString(svgEl))
      await ipc.writeTextFile({ filePath: path, content: data })
      ElMessage.warning('PNG 导出失败（' + getErrorMessage(e, String(e)) + '），已改导出 SVG 文件：' + path)
    } catch {
      ElMessage.error('导出流程图失败：' + getErrorMessage(e, String(e)))
    }
  }
}

watch(
  () => parsed.value.html,
  async () => {
    await nextTick()
    renderMermaid()
  },
  { flush: 'post' },
)

onMounted(() => {
  renderMermaid()
})

onUnmounted(() => {
  closeMenu()
})
</script>

<style scoped>
.markdown-text {
  font-size: var(--el-font-size-small);
  line-height: 1.85;
  word-break: break-word;
}
.markdown-body :deep(> :first-child) {
  margin-top: 0;
}
.markdown-body :deep(> :last-child) {
  margin-bottom: 0;
}
.markdown-text :deep(h1),
.markdown-text :deep(h2),
.markdown-text :deep(h3),
.markdown-text :deep(h4) {
  font-size: 13px;
  font-weight: 600;
  margin: 12px 0 6px;
}
.markdown-text :deep(p) {
  margin: 0 0 10px;
}
.markdown-text :deep(ul),
.markdown-text :deep(ol) {
  margin: 0 0 10px;
  padding-left: 20px;
}
.markdown-text :deep(li) {
  margin: 3px 0 8px;
}
.markdown-text :deep(li:last-child) {
  margin-bottom: 0;
}
.markdown-text :deep(li > p) {
  margin: 0;
}
.markdown-text :deep(.table-wrap) {
  margin: 4px 0 10px;
  overflow-x: auto;
}
.markdown-text :deep(table) {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.markdown-text :deep(th),
.markdown-text :deep(td) {
  padding: 4px 6px;
  border: 1px solid var(--el-border-color-lighter);
  text-align: left;
  vertical-align: top;
}
.markdown-text :deep(th) {
  background: var(--el-fill-color-light);
  font-weight: 600;
}
.markdown-text :deep(.mermaid-block) {
  margin: 4px 0 10px;
  overflow-x: auto;
}
.markdown-text :deep(.mermaid-block svg) {
  display: block;
}
.markdown-text :deep(.mermaid-failed) {
  margin: 4px 0 10px;
  padding: 8px;
  background: var(--el-fill-color);
  border-radius: var(--app-radius-sm);
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
}
.markdown-text :deep(code) {
  padding: 1px 4px;
  background: var(--el-fill-color);
  border-radius: 3px;
  font-size: 12px;
}
.markdown-text :deep(pre) {
  padding: 8px;
  background: var(--el-fill-color);
  border-radius: var(--app-radius-sm);
  overflow: auto;
}
.markdown-text :deep(pre code) {
  padding: 0;
  background: none;
}
.markdown-text :deep(blockquote) {
  margin: 0 0 6px;
  padding-left: 8px;
  border-left: 2px solid var(--el-border-color);
  color: var(--el-text-color-secondary);
}
.markdown-text :deep(hr) {
  border: none;
  border-top: 1px solid var(--el-border-color-lighter);
  margin: 8px 0;
}
.markdown-text :deep(a) {
  color: var(--el-color-primary);
}
.mermaid-menu {
  position: fixed;
  z-index: 3000;
  min-width: 130px;
  padding: 4px 0;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--app-radius-sm);
  box-shadow: var(--el-box-shadow-light);
}
.mermaid-menu-item {
  padding: 6px 14px;
  font-size: 12px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  white-space: nowrap;
}
.mermaid-menu-item:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
</style>
