/*
 * @Author: zhengrenfu
 * @Date: 2026-08-27 10:27:07
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-28 12:14:04
 * @FilePath: \src\composables\useDrawerResize.ts
 * @Description: 抽屉左侧边缘拖拽调整宽度功能
 */

import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import { ipc } from '@/utils/ipc'

// #region 缓存管理

// 内存宽度缓存，抽屉重新打开时无需等待 IPC 即可恢复上次宽度，避免先窄后宽的闪动
const savedWidthCache = new Map<string, number>()

/**
 * 读取宽度同步缓存，优先内存，未命中再查 localStorage
 * @param {string} key 存储键
 * @returns 缓存宽度，无缓存时返回 undefined
 */
function readWidthCache(key: string): number | undefined {
  if (savedWidthCache.has(key)) return savedWidthCache.get(key)
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) {
      const value = Number(raw)
      if (Number.isFinite(value) && value > 0) {
        savedWidthCache.set(key, value)
        return value
      }
    }
  } catch {
    // localStorage 不可用时忽略缓存
  }
  return undefined
}

/**
 * 写入宽度同步缓存，内存与 localStorage 双写
 * @param {string} key 存储键
 * @param {number} value 宽度值
 */
function writeWidthCache(key: string, value: number) {
  savedWidthCache.set(key, value)
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // localStorage 不可用时忽略缓存
  }
}

// #endregion

// #region useDrawerResize 主函数

/**
 * 为 el-drawer 启用左侧边缘拖拽调整宽度功能
 * @param {import('vue').Ref<boolean>} visible 抽屉显示状态的 ref
 * @param {object} options 配置项
 * @param {number} options.min 最小宽度（像素）
 * @param {number} options.max 最大宽度（像素）
 * @param {string} options.storageKey 宽度持久化存储键，配置后拖拽结束自动保存，再次打开自动恢复
 * @param {import('vue').Ref<HTMLElement | null>} handleRef 拖拽手柄元素引用，用于打开抽屉时定位所属抽屉
 * @returns {object} handleResizeMousedown 边缘 mousedown 事件处理函数
 */
export function useDrawerResize(
  visible: import('vue').Ref<boolean>,
  options: { min?: number; max?: number; storageKey?: string } = {},
  handleRef?: import('vue').Ref<HTMLElement | null>,
) {
  const { min = 280, max = 1000, storageKey = '' } = options
  const drawerWidth = ref(0)
  let startX = 0
  let startWidth = 0
  let wrapper: HTMLElement | null = null

  // #region DOM 查找

  /**
   * 从事件源向上查找所属的抽屉包裹层 DOM 元素
   * 页面存在多个抽屉时需按事件源定位，避免全局查询命中错误抽屉
   * @param {MouseEvent} e 鼠标事件对象
   * @returns 抽屉包裹层元素，未找到时返回 null
   */
  function getWrapper(e: MouseEvent): HTMLElement | null {
    return (e.currentTarget as HTMLElement).closest('.el-drawer') as HTMLElement | null
  }

  // #endregion

  // #region 拖拽事件处理

  /**
   * 鼠标按下时初始化拖拽状态，记录起始位置并绑定移动和释放事件
   * @param {MouseEvent} e 鼠标事件对象
   */
  function onMousedown(e: MouseEvent) {
    wrapper = getWrapper(e)
    if (!wrapper) return

    startX = e.clientX
    startWidth = wrapper.offsetWidth
    drawerWidth.value = startWidth

    document.addEventListener('mousemove', onMousemove)
    document.addEventListener('mouseup', onMouseup)
    e.preventDefault()
  }

  /**
   * 鼠标移动时实时计算新宽度并限制在合法范围内，同步更新抽屉宽度
   * @param {MouseEvent} e 鼠标事件对象
   */
  function onMousemove(e: MouseEvent) {
    const delta = startX - e.clientX
    const newWidth = Math.max(min, Math.min(max, startWidth + delta))
    drawerWidth.value = newWidth
    if (wrapper) {
      wrapper.style.width = `${newWidth}px`
    }
  }

  /**
   * 鼠标释放时清理事件监听，并保存拖拽后的宽度供下次打开恢复
   */
  async function onMouseup() {
    document.removeEventListener('mousemove', onMousemove)
    document.removeEventListener('mouseup', onMouseup)
    // 已配置持久化键且存在宽度记录时写入本地存储与同步缓存
    if (storageKey && drawerWidth.value > 0) {
      const width = Math.round(drawerWidth.value)
      writeWidthCache(storageKey, width)
      await ipc.storeSet(storageKey, width)
    }
  }

  // #endregion

  // #region 状态重置

  /**
   * 重置宽度并清除 DOM 上的内联宽度样式
   */
  function reset() {
    drawerWidth.value = 0
    if (wrapper) {
      wrapper.style.width = ''
      wrapper = null
    }
  }

  // #endregion

  // #region 生命周期

  watch(visible, async (v) => {
    if (!v) {
      reset()
      return
    }
    if (!storageKey) return
    // 优先使用同步缓存，未命中时才走 IPC 查询，避免打开瞬间宽度先小后大
    let stored = readWidthCache(storageKey)
    if (typeof stored !== 'number') {
      stored = await ipc.storeGet(storageKey)
      if (typeof stored === 'number' && stored > 0) writeWidthCache(storageKey, stored)
    }
    if (typeof stored !== 'number' || stored <= 0) return
    await nextTick()
    wrapper = handleRef?.value?.closest('.el-drawer') as HTMLElement | null
    if (!wrapper) return
    const width = Math.max(min, Math.min(max, stored))
    drawerWidth.value = width
    wrapper.style.width = `${width}px`
  })

  onBeforeUnmount(() => {
    reset()
    document.removeEventListener('mousemove', onMousemove)
    document.removeEventListener('mouseup', onMouseup)
  })

  // #endregion

  return {
    handleResizeMousedown: onMousedown,
  }
}
