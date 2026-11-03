/*
 * @Author: zhengrenfu
 * @Date: 2026-08-28 01:45:33
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-28 12:14:04
 * @FilePath: \src\utils\color.ts
 * @Description: 颜色处理工具函数
 */

// #region 颜色转换

/**
 * 将十六进制颜色转换为指定透明度的 rgba 颜色字符串
 * @param {string} hex 十六进制颜色值（支持 #rgb、#rrggbb 格式）
 * @param {number} alpha 透明度，取值范围 0-1
 * @returns {string} rgba 颜色字符串
 */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  let r: number, g: number, b: number

  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16)
    g = parseInt(clean[1] + clean[1], 16)
    b = parseInt(clean[2] + clean[2], 16)
  } else {
    r = parseInt(clean.slice(0, 2), 16)
    g = parseInt(clean.slice(2, 4), 16)
    b = parseInt(clean.slice(4, 6), 16)
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * 生成从指定颜色到透明的渐变色对象，用于 ECharts 面积图渐变
 * 上深（原始颜色）下浅（透明），适用于折线面积图的垂直渐变
 * @param {string} color 十六进制颜色值
 * @param {number} topAlpha 顶部透明度，默认 0.6
 * @param {number} bottomAlpha 底部透明度，默认 0.05
 * @returns {object} ECharts 渐变色配置对象
 */
export function createAreaGradient(color: string, topAlpha = 0.6, bottomAlpha = 0.05) {
  return {
    type: 'linear',
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: hexToRgba(color, topAlpha) },
      { offset: 1, color: hexToRgba(color, bottomAlpha) },
    ],
  }
}

// #endregion

// #region CSS 变量与样式

/**
 * 从 CSS 变量读取值，读取失败时返回兜底值
 * @param {string} varName CSS 变量名（不含 -- 前缀）
 * @param {string} fallback 兜底值
 * @returns {string} 变量值
 */
function getCssVar(varName: string, fallback: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(`--${varName}`).trim() || fallback
  } catch {
    return fallback
  }
}

/**
 * 获取 ECharts tooltip 的苹果风格玻璃质感样式配置，与全局 CSS 变量保持一致
 * @param {boolean} isDark 是否为深色主题
 * @returns {object} ECharts tooltip 外观配置对象
 */
export function getGlassTooltipStyle(isDark: boolean) {
  const bg = getCssVar('app-glass-bg-light', isDark ? 'rgba(30, 30, 30, 0.85)' : 'rgba(255, 255, 255, 0.88)')
  const border = getCssVar('app-glass-border', isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')
  const shadow = getCssVar(
    'app-glass-shadow',
    isDark
      ? '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
      : '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
  )
  const blur = getCssVar('app-glass-blur', '12px')
  const radius = getCssVar('app-radius-lg', '8px')
  const textColor = isDark ? '#e5eaf3' : '#303133'

  return {
    backgroundColor: bg,
    borderColor: border,
    borderWidth: 1,
    borderRadius: parseInt(radius),
    boxShadow: shadow,
    textStyle: {
      color: textColor,
      fontSize: 13,
    },
    extraCssText: `backdrop-filter: blur(${blur}); -webkit-backdrop-filter: blur(${blur}); line-height: 20px;`,
  }
}

/**
 * 生成带颜色点的 tooltip 行 HTML，使用 flex 布局并设置 gap
 * @param {string} color 颜色值
 * @param {string} text 显示文本
 * @returns {string} 格式化后的 HTML 字符串
 */
export function tooltipRow(color: string | undefined, text: string): string {
  if (!color) return text
  return `<div style="display:flex;align-items:center;gap:5px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></span><span>${text}</span></div>`
}

// #endregion
