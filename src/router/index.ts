/*
 * @Author: zhengrenfu
 * @Date: 2026-07-14 21:36:19
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-09-21 00:00:00
 * @FilePath: \src\router\index.ts
 * @Description: 路由配置与上次激活菜单恢复
 */

import { createRouter, createWebHashHistory } from 'vue-router'
import { ipc } from '@/utils/ipc'
import ExportTask from '@/views/ExportTask/index.vue'
import CheckTask from '@/views/CheckTask/index.vue'
import TaskExtract from '@/views/TaskExtract/index.vue'
import HistoryTask from '@/views/HistoryTask/index.vue'
import Workbench from '@/views/Workbench/index.vue'

// #region 路由配置

// 无记录或记录失效时进入的默认菜单
const DEFAULT_MENU_PATH = '/workbench'

const routes = [
  {
    path: '/',
    // 仅作为兜底，应用启动时由前置守卫改跳上次激活的菜单
    redirect: DEFAULT_MENU_PATH,
  },
  {
    path: '/workbench',
    name: 'Workbench',
    component: Workbench,
    meta: { title: '工作台' },
  },
  {
    path: '/history-task',
    name: 'HistoryTask',
    component: HistoryTask,
    meta: { title: '历史任务' },
  },
  {
    path: '/extract-task',
    name: 'TaskExtract',
    component: TaskExtract,
    meta: { title: '提取任务' },
  },
  {
    path: '/check-task',
    name: 'CheckTask',
    component: CheckTask,
    meta: { title: '检查任务' },
  },
  {
    path: '/export-task',
    name: 'ExportTask',
    component: ExportTask,
    meta: { title: '导出任务' },
  },
]

// #endregion

// #region 路由实例

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// #endregion

// #region 上次激活菜单

const LAST_MENU_STORAGE_KEY = 'lastActiveMenu'

// 左侧菜单路径，用于校验上次记录是否仍然有效
const MENU_PATHS: string[] = routes.filter((r) => r.path !== '/').map((r) => r.path)

// 是否已完成启动恢复，避免恢复动作再次触发守卫造成重定向循环
let menuRestored = false

/**
 * 读取上次激活的菜单路径
 * 记录已失效（菜单调整、数据损坏）或 preload 未就绪时回退默认菜单
 *
 * @returns 可用的菜单路径
 */
async function loadLastMenuPath(): Promise<string> {
  try {
    const saved = await ipc.storeGet(LAST_MENU_STORAGE_KEY)
    return MENU_PATHS.includes(saved) ? saved : DEFAULT_MENU_PATH
  } catch {
    return DEFAULT_MENU_PATH
  }
}

/**
 * 应用启动进入根路径时改跳上次激活的菜单
 * 地址栏已带菜单 hash（应用内刷新）时不拦截，按当前地址打开
 */
router.beforeEach(async (to) => {
  if (menuRestored || to.redirectedFrom?.path !== '/') return true
  menuRestored = true
  const path = await loadLastMenuPath()
  return path === to.path ? true : { path, replace: true }
})

/**
 * 菜单切换后记录当前路径，供下次启动恢复
 */
router.afterEach((to) => {
  if (MENU_PATHS.includes(to.path)) ipc.storeSet(LAST_MENU_STORAGE_KEY, to.path)
})

// #endregion

export default router
