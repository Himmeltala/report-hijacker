/*
 * @Author: zhengrenfu
 * @Date: 2026-07-14 09:46:10
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-28 12:14:04
 * @FilePath: \..\\src\\composables\\useEcharts.ts
 * @Description: 描述
 */

// @ts-nocheck
import { isReactive, isRef, nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import * as echarts from 'echarts'

// #region 主题辅助函数

/**
 * 获取当前页面主题对应的 ECharts 主题名
 * @returns 深色模式返回内置 dark 主题，浅色模式返回 undefined 使用默认主题
 */
function getCurrentTheme(): string | undefined {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : undefined
}

/**
 * 判断当前页面是否处于深色主题
 * @returns 深色主题时为 true
 */
function isDarkTheme(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark'
}

/**
 * 读取 Element Plus 主题 CSS 变量值
 * @param {string} varName CSS 变量名（不含 -- 前缀）
 * @returns 变量值字符串，读取失败时返回空字符串
 */
function getElCssVar(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${varName}`).trim()
}

/**
 * 获取当前主题下 ECharts 图表的文字颜色配置
 * @returns 包含 primary、regular、secondary 三级文字颜色的对象
 */
function getThemeTextColors() {
  return {
    primary: getElCssVar('el-text-color-primary') || (isDarkTheme() ? '#e5eaf3' : '#303133'),
    regular: getElCssVar('el-text-color-regular') || (isDarkTheme() ? '#cfd3dc' : '#606266'),
    secondary: getElCssVar('el-text-color-secondary') || (isDarkTheme() ? '#a3a6ad' : '#909399'),
  }
}

// #endregion

// #region 工具函数

/**
 * 简易防抖函数，返回带取消能力的防抖包装
 * @param {Function} fn 需要防抖的函数
 * @param {number} delay 防抖延迟毫秒数
 * @returns {Function & { cancel: Function }} 防抖包装函数，附带 cancel 方法
 */
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  const debounced = (...args: any[]) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
  debounced.cancel = () => {
    if (timer) clearTimeout(timer)
  }
  return debounced
}

// #endregion

// #region useChartRoll 主函数

/**
 * 创建可轮播的 ECharts 图表控制器，数据超长时自动轮播展示
 * @param {object} options 控制器配置
 * @param {object} options.chartRef 图表挂载的 DOM 引用
 * @param {object} options.dataSource 图表数据源（支持 ref 与 reactive）
 * @param {Function} options.xAxis 从数据中提取 X 轴数据的函数
 * @param {Function} options.generateOption 根据数据生成图表配置项的函数
 * @param {number} [options.maxLength] 单屏展示的最大数据条数，超长时轮播，-1 不限制
 * @param {number} [options.delay] 轮播间隔毫秒数
 * @param {boolean} [options.overrideXAxis] 是否用切片结果覆盖生成的 X 轴数据
 * @returns {object} 图表控制方法集合（render、play、stop、dispose 等）
 */
function useChartRoll({
  chartRef,
  dataSource,
  xAxis,
  generateOption,
  maxLength = 6,
  delay = 1000,
  overrideXAxis = true,
}: {
  chartRef: any
  dataSource: any
  xAxis: (data: any) => any[]
  generateOption: (data: any, chart: any) => any
  maxLength?: number
  delay?: number
  overrideXAxis?: boolean
}) {
  // #region 内部状态

  let chart: any = null
  let timer: ReturnType<typeof setInterval> | null = null
  let dataCache: any[] = []
  let disposed = false
  let renderRetries = 0
  // 图表当前使用的主题，主题切换时重建图表实例
  let chartTheme: string | undefined = getCurrentTheme()
  // 监听根节点主题属性变化，深色与浅色切换时重建图表
  let themeObserver: MutationObserver | null = null
  // 监听图表容器尺寸变化时重绘图表
  let resizeObserver: ResizeObserver | null = null
  const dataList = ref(null)

  // 容器尺寸为 0 时的最大等待帧数，超过后放弃本轮渲染
  const MAX_RENDER_RETRIES = 30

  // #endregion

  // #region 数据监听

  watch(
    () => unwrapResponsive(maxLength),
    () => {
      render()
      play()
    },
  )

  watch(
    () => unwrapResponsive(chartRef),
    (el) => {
      if (el) {
        bindResizeObserver(el)
        nextTick(() => {
          render(true)
          play()
        })
      }
    },
    { deep: true },
  )

  function syncDataList(nv: any) {
    if (nv) {
      dataList.value = isRef(nv) ? nv.value : isReactive(nv) ? toRaw(nv) : nv
    }
  }

  {
    const src = dataSource
    syncDataList(isRef(src) ? src.value : src)
  }

  watch(
    () => {
      const src = dataSource
      return isRef(src) ? src.value : src
    },
    (nv) => {
      syncDataList(nv)
      nextTick(() => {
        render()
        play()
      })
    },
    { deep: true },
  )

  // #endregion

  // #region 尺寸监听

  const debounceResize = debounce(() => {
    try {
      chart?.resize()
    } catch {
      // disposed
    }
  }, 250)

  /**
   * 绑定图表容器尺寸变化监听，容器宽高变化时触发图表重绘
   * @param {HTMLElement | null} el 图表容器元素
   */
  function bindResizeObserver(el: HTMLElement | null) {
    if (!el || typeof ResizeObserver === 'undefined') return
    resizeObserver?.disconnect()
    resizeObserver = new ResizeObserver(() => debounceResize())
    resizeObserver.observe(el)
  }

  // #endregion

  // #region 辅助函数

  function unwrapResponsive(value: any) {
    if (isRef(value)) return toRaw(value.value)
    if (isReactive(value)) return toRaw(value)
    return value
  }

  function isArray(arr: any) {
    return !!(arr && Array.isArray(arr))
  }

  function slice() {
    const axisData = xAxis(dataList.value) || []
    const currentMaxLength = unwrapResponsive(maxLength)
    if (!isArray(dataList.value) || dataList.value.length <= currentMaxLength) return axisData
    if (currentMaxLength === -1) return axisData
    return axisData.slice(0, currentMaxLength).filter((i: any) => i !== null && i !== undefined)
  }

  // #endregion

  // #region 渲染与轮播

  function render(init = false) {
    if (disposed) return
    nextTick(() => {
      if (!chartRef.value) return
      if (!chart || init) {
        const el = chartRef.value
        if (!el.clientWidth || !el.clientHeight) {
          // 容器未布局完成时等待下一帧，超过上限后放弃，数据变化或尺寸调整会重新触发
          if (++renderRetries <= MAX_RENDER_RETRIES && !disposed) {
            requestAnimationFrame(() => render(init))
          }
          return
        }
        renderRetries = 0
        // 先销毁旧实例，避免重复初始化警告
        if (chart) {
          try {
            chart.dispose()
          } catch {
            // disposed
          }
        }
        chart = echarts.init(el, chartTheme)
        chart.resize()
      }
      const option = generateOption(dataList.value, chart) || {}
      if (xAxis && overrideXAxis && option.xAxis) {
        option.xAxis.data = slice()
      }
      if (chart && !chart.isDisposed()) {
        chart.setOption(option)
      }
    })
  }

  function play() {
    stop()
    const currentMaxLength = unwrapResponsive(maxLength)
    if (currentMaxLength === -1 || !isArray(dataList.value) || dataList.value.length <= currentMaxLength) return
    dataCache = [...dataList.value]
    timer = setInterval(() => {
      dataCache.push(dataCache.shift()!)
      dataList.value = [...dataCache]
      render()
    }, delay)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  // #endregion

  // #region 生命周期与清理

  function dispose() {
    disposed = true
    stop()
    if (themeObserver) {
      themeObserver.disconnect()
      themeObserver = null
    }
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    try {
      chart?.off()
      chart?.dispose()
    } catch {
      // dom already removed
    }
    chart = null
    window.removeEventListener('resize', debounceResize)
  }

  // #endregion

  // #region 公共方法

  function updateOption(newOptionFunc: any) {
    generateOption = newOptionFunc
    render()
    play()
  }

  function getOption() {
    return generateOption(dataList.value, chart)
  }

  function getDataURL(option = {}) {
    if (!chart) return
    const picbase64 = chart.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#fff',
      ...option,
    })
    const link = document.createElement('a')
    link.href = picbase64
    const picname = option?.title || '图片_' + new Date().getTime()
    link.download = `${picname}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // #endregion

  // #region 生命周期钩子

  onMounted(() => {
    nextTick(() => {
      render()
      play()
      bindResizeObserver(chartRef.value)
      window.addEventListener('resize', debounceResize)
      // 主题切换时销毁旧实例并按新主题重建
      themeObserver = new MutationObserver(() => {
        const nextTheme = getCurrentTheme()
        if (nextTheme === chartTheme) return
        chartTheme = nextTheme
        try {
          chart?.dispose()
        } catch {
          // disposed
        }
        chart = null
        render(true)
      })
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme'],
      })
    })
  })

  onBeforeUnmount(() => {
    dispose()
  })

  // #endregion

  return {
    chart,
    chartRef,
    render,
    play,
    stop,
    dispose,
    getDataURL,
    getOption,
    updateOption,
    debounceResize,
  }
}

// #endregion

export { useChartRoll, isDarkTheme, getThemeTextColors }
