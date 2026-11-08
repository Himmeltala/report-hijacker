/*
 * @Author: zhengrenfu
 * @Date: 2026-11-08
 * @Description: AI 提示词纯函数：占位符替换、富文本转纯文本
 */

// #region 常量

// 上下文片段送入提示词的最大字符数，控制 token 体积
export const MAX_CONTEXT_CHARS = 4000

// #endregion

// #region 提示词工具

/**
 * 将提示词模板中的占位符替换为上下文值
 * @param {string} template 提示词模板，占位符如 {title}
 * @param {Record<string, string>} ctx 占位符值
 * @returns {string} 替换后的完整提示词
 */
export function fillPrompt(template: string, ctx: Record<string, string>): string {
  let out = template
  for (const [key, val] of Object.entries(ctx)) {
    out = out.split(`{${key}}`).join(val || '(空)')
  }
  return out
}

/**
 * 去除 HTML 标签并还原常见实体，将富文本转为纯文本
 *
 * 图片统一保留为 [图片] 占位，避免审查时把流程图、成果物截图当成缺失项
 * @param {string} raw 原文（可能含 HTML 或 Markdown）
 * @returns {string} 纯文本
 */
export function toPlainText(raw: string): string {
  return raw
    .replace(/<mention\b[^>]*data-text="([^"]*)"[^>]*>/gi, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<img\b[^>]*>/gi, (tag: string) => {
      const alt = /\balt="([^"]*)"/i.exec(tag)?.[1]
      return alt ? `[图片:${alt}]` : '[图片]'
    })
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_m, alt: string) => (alt ? `[图片:${alt}]` : '[图片]'))
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/^[\s|]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}


// #region 模型输出清洗

/**
 * 去掉模型返回的代码围栏，只保留源码
 * @param {string} text 模型输出
 * @returns {string} 去掉围栏后的文本
 */
export function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  const matched = trimmed.match(/```[a-zA-Z]*\s*\n([\s\S]*?)```/)
  if (matched) return matched[1].trim()
  // 围栏没闭合时去掉开头那一行和末尾残留的反引号
  return trimmed
    .replace(/^```[a-zA-Z]*\s*\n?/, '')
    .replace(/```\s*$/, '')
    .trim()
}

// #endregion
