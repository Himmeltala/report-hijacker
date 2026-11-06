<!--
 * @Author: zhengrenfu
 * @Date: 2026-11-05 09:14:14
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-06 08:50:00
 * @FilePath: /pros/self/task-manager/src/App.vue
 * @Description: 根组件
-->
<template>
  <div class="app-root" :class="themeClass">
    <div class="sidebar">
      <el-menu
        :default-active="currentRoute"
        class="sidebar-menu"
        :collapse-transition="false"
        @select="handleMenuSelect"
      >
        <el-menu-item index="/workbench">
          <el-icon><Bell /></el-icon>
          <span>工作台</span>
        </el-menu-item>
        <el-menu-item index="/history-task">
          <el-icon><Clock /></el-icon>
          <span>历史任务</span>
        </el-menu-item>
        <el-menu-item index="/extract-task">
          <el-icon><UserFilled /></el-icon>
          <span>提取任务</span>
        </el-menu-item>
        <el-menu-item index="/check-task">
          <el-icon><Connection /></el-icon>
          <span>检查任务</span>
        </el-menu-item>
        <el-menu-item index="/export-task">
          <el-icon><EditPen /></el-icon>
          <span>导出任务</span>
        </el-menu-item>
        <el-menu-item index="/ai-assistant">
          <el-icon><ChatDotRound /></el-icon>
          <span>AI 助手</span>
        </el-menu-item>
      </el-menu>

      <div class="sidebar-footer">
        <el-dropdown
          style="width: 100%"
          trigger="click"
          popper-class="profile-dropdown"
          @command="handleProfileCommand"
          @visible-change="onProfileDropdownVisible"
        >
          <div class="profile-trigger">
            <el-icon><UserFilled /></el-icon>
            <span class="profile-name">{{ currentProfile }}</span>
            <el-icon class="profile-arrow"><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="p in profileList"
                :key="p"
                :command="{ action: 'switch', name: p }"
                :class="{ 'is-active': p === currentProfile }"
              >
                <el-icon v-if="p === currentProfile"><Check /></el-icon>
                <span>{{ p }}</span>
              </el-dropdown-item>
              <el-dropdown-item divided :command="{ action: 'manage' }">
                <el-icon><Setting /></el-icon>
                <span>管理用户</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <div class="content-col">
      <div class="main-area">
        <router-view :key="routeKey" />
      </div>

      <GlobalLogPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { EditPen, Connection, UserFilled, Clock, Bell, ArrowDown, Check, Setting, ChatDotRound } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useLogStore } from '@/stores/log.store'
import { useModal } from '@/composables/useModal'
import { useUpdater } from '@/composables/useUpdater'
import GlobalLogPanel from '@/components/GlobalLogPanel.vue'

const store = useSettingsStore()
const logStore = useLogStore()
const router = useRouter()
const route = useRoute()

const theme = ref('dark')
const themeClass = computed(() => `theme-${theme.value}`)
const currentRoute = computed(() => route.path)
const routeKey = ref(0)

const currentProfile = ref('')
const profileList = ref<string[]>([])

const updater = useUpdater()

const settingsModal = useModal({ component: () => import('@/modals/SettingsModal.vue') })
const profileModal = useModal({ component: () => import('@/modals/ProfileModal.vue') })

async function loadProfiles() {
  try {
    currentProfile.value = await window.electron.profileCurrent()
    profileList.value = await window.electron.profileList()
  } catch (e) {
    logStore.addLog('error', `加载用户档案失败: ${(e as Error).message || e}`)
  }
}

async function onProfileDropdownVisible(visible: boolean) {
  if (visible) {
    // 下拉刷新静默失败
    try {
      await loadProfiles()
    } catch {
      // 忽略
    }
  }
}

async function handleProfileCommand(cmd: { action: string; name?: string }) {
  if (cmd.action === 'switch' && cmd.name && cmd.name !== currentProfile.value) {
    await switchProfile(cmd.name)
  } else if (cmd.action === 'manage') {
    profileModal.open()
  }
}

async function switchProfile(name: string) {
  try {
    await window.electron.profileSwitch(name)
    // 切换后主进程发送 profile:switched 事件，界面更新统一在事件中处理
  } catch (e) {
    logStore.addLog('error', `切换用户失败: ${(e as Error).message || e}`)
  }
}

async function handleProfileSwitched(_name: string) {
  // 先完成新档案配置加载，再重挂载页面，避免页面用旧档案配置发起请求
  await store.loadConfig()
  // 应用新档案的主题设置
  try {
    const savedTheme = await window.electron.getSetting('appearance.theme')
    theme.value = savedTheme || 'dark'
  } catch {
    theme.value = 'dark'
  }
  applyTheme(theme.value)
  // 重新加载日志面板设置（面板高度与行数按档案配置生效）
  logStore.loadSettings()
  // 强制所有页面组件重新挂载，确保数据全部刷新
  routeKey.value++
}

function handleMenuSelect(index: string) {
  router.push(index)
}

function applyTheme(t: string) {
  if (t === 'dark') {
    document.documentElement.classList.add('dark')
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    document.documentElement.setAttribute('data-theme', 'light')
  }
}

// 注册监听器，preload 未就绪时不抛错
const cleanupTheme = window.electron?.onThemeChanged?.((newTheme: string) => {
  theme.value = newTheme
  applyTheme(newTheme)
})

const cleanupMenu = window.electron?.onMenuEvent?.(({ action }) => {
  if (action === 'settings') settingsModal.open()
})

// 自动检查发现新版本时由主进程推送，这里负责弹窗确认
const cleanupUpdate = window.electron?.onUpdateAvailable?.((data) => {
  logStore.addLog('info', `发现新版本 ${data.version || ''}，等待更新确认`)
  updater.offerUpdate(data)
})

const cleanupProfile = window.electron?.onProfileSwitched?.((name: string) => {
  currentProfile.value = name
  handleProfileSwitched(name)
})

onMounted(async () => {
  // 配置已在启动阶段加载，此处不重复
  logStore.loadSettings()

  await loadProfiles()

  try {
    const savedTheme = await window.electron.getSetting('appearance.theme')
    theme.value = savedTheme || 'dark'
  } catch {
    theme.value = 'dark'
  }
  applyTheme(theme.value)

  // 全局异常自动送入日志面板
  const origConsoleError = console.error
  console.error = (...args) => {
    origConsoleError.apply(console, args)
    logStore.addLog(
      'error',
      args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
    )
  }

  const origConsoleWarn = console.warn
  console.warn = (...args) => {
    origConsoleWarn.apply(console, args)
    logStore.addLog(
      'warning',
      args
        .map((a) => {
          if (typeof a === 'string') return a
          try {
            return JSON.stringify(a)
          } catch {
            return String(a)
          }
        })
        .join(' '),
    )
  }

  window.onerror = (_msg, _source, _lineno, _colno, err) => {
    const msg = err?.message || String(_msg)
    logStore.addLog('error', `[Runtime] ${msg}`)
  }

  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
    logStore.addLog('error', `[Promise] ${msg}`)
  })
})

onBeforeUnmount(() => {
  cleanupTheme?.()
  cleanupMenu?.()
  cleanupProfile?.()
  cleanupUpdate?.()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
:root {
  --app-sidebar-width: 180px;
  --app-space-1: 4px;
  --app-space-2: 8px;
  --app-space-3: 12px;
  --app-space-4: 16px;
  --app-space-5: 20px;
  --app-space-6: 24px;
  --app-padding-toolbar: var(--app-space-1) var(--app-space-2);
  --app-padding-compact: 2px var(--app-space-2);
  --app-gap-toolbar: var(--app-space-1);
  --app-gap-section: var(--app-space-3);
  --app-gap-group: var(--app-space-5);
  --app-radius-base: 6px;
  --app-radius-sm: 4px;
  --app-radius-lg: 8px;
  --app-radius-xl: 12px;
  /* 毛玻璃效果变量 */
  --app-glass-blur: 12px;
  --app-glass-blur-lg: 16px;
  --app-glass-blur-sm: 4px;
}
[data-theme='dark'] {
  --app-glass-bg: rgba(30, 30, 30, 0.92);
  --app-glass-bg-light: rgba(30, 30, 30, 0.85);
  --app-glass-border: rgba(255, 255, 255, 0.08);
  --app-glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  --app-glass-shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  --app-glass-shadow-inset: inset 1px 0 0 rgba(255, 255, 255, 0.05);
  --app-glass-overlay: rgba(0, 0, 0, 0.6);
}
[data-theme='light'] {
  --app-glass-bg: rgba(255, 255, 255, 0.92);
  --app-glass-bg-light: rgba(255, 255, 255, 0.88);
  --app-glass-border: rgba(0, 0, 0, 0.06);
  --app-glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  --app-glass-shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  --app-glass-shadow-inset: inset 1px 0 0 rgba(255, 255, 255, 0.8);
  --app-glass-overlay: rgba(0, 0, 0, 0.5);
}
html,
body,
#app {
  height: 100%;
  overflow: hidden;
  font-family: var(--el-font-family, 'Microsoft YaHei', Arial, sans-serif);
}
body {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

/* 全局滚动条样式，与 el-scrollbar 保持一致 */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--el-scrollbar-bg-color, rgba(144, 147, 153, 0.3)) transparent;
}
*::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
*::-webkit-scrollbar-track {
  background: transparent;
}
*::-webkit-scrollbar-thumb {
  background-color: var(--el-scrollbar-bg-color, rgba(144, 147, 153, 0.3));
  border-radius: 3px;
  transition: background-color 0.3s;
}
*::-webkit-scrollbar-thumb:hover {
  background-color: var(--el-scrollbar-hover-bg-color, rgba(144, 147, 153, 0.5));
}
*::-webkit-scrollbar-corner {
  background: transparent;
}
.text-muted {
  color: var(--el-text-color-placeholder);
}
.profile-dropdown {
  width: 155px;
}

/* Element Plus 全局圆角统一 */
.el-button {
  border-radius: var(--app-radius-sm) !important;
}
.el-input__wrapper,
.el-textarea__inner {
  border-radius: var(--app-radius-base) !important;
}
.el-select__wrapper,
.el-select-dropdown {
  border-radius: var(--app-radius-sm) !important;
}
.el-tag {
  border-radius: var(--app-radius-sm) !important;
}
.el-table {
  border-radius: var(--app-radius-base) !important;
  overflow: hidden;
}
.el-table th:first-child,
.el-table td:first-child {
  border-radius: var(--app-radius-base) 0 0 0 !important;
}
.el-table th:last-child,
.el-table td:last-child {
  border-radius: 0 var(--app-radius-base) 0 0 !important;
}
.el-table th:first-child.is-leaf,
.el-table td:first-child.is-last-child {
  border-radius: 0 0 0 var(--app-radius-base) !important;
}
.el-table th:last-child.is-leaf,
.el-table td:last-child.is-last-child {
  border-radius: 0 0 var(--app-radius-base) 0 !important;
}
.el-card {
  border-radius: var(--app-radius-base) !important;
}
.el-tabs__header {
  border-radius: var(--app-radius-base) var(--app-radius-base) 0 0 !important;
}
.el-tabs__item {
  border-radius: var(--app-radius-sm) !important;
}
.el-pagination {
  --el-pagination-border-radius: var(--app-radius-sm);
}
.el-alert {
  border-radius: var(--app-radius-sm) !important;
}
.el-radio-button__inner {
  border-radius: var(--app-radius-sm) !important;
}
.el-radio-button:first-child .el-radio-button__inner {
  border-radius: var(--app-radius-sm) 0 0 var(--app-radius-sm) !important;
}
.el-radio-button:last-child .el-radio-button__inner {
  border-radius: 0 var(--app-radius-sm) var(--app-radius-sm) 0 !important;
}
.el-checkbox__inner {
  border-radius: var(--app-radius-sm) !important;
}
.el-switch {
  --el-switch-border-radius: var(--app-radius-base);
}
.el-progress-bar__outer {
  border-radius: var(--app-radius-sm) !important;
}
.el-progress-bar__inner {
  border-radius: var(--app-radius-sm) !important;
}
.el-empty__image svg {
  border-radius: var(--app-radius-base);
}
.el-descriptions {
  border-radius: var(--app-radius-sm) !important;
  overflow: hidden;
}
.el-collapse {
  border-radius: var(--app-radius-sm) !important;
  overflow: hidden;
}
.el-collapse-item__header {
  border-radius: var(--app-radius-sm) !important;
}
.el-form-item__label {
  border-radius: var(--app-radius-sm) !important;
}
.el-slider__runway {
  border-radius: var(--app-radius-sm) !important;
}
.el-slider__bar {
  border-radius: var(--app-radius-sm) !important;
}
.el-slider__button-wrapper {
  border-radius: 50% !important;
}
.el-upload {
  border-radius: var(--app-radius-sm) !important;
}
.el-upload-dragger {
  border-radius: var(--app-radius-sm) !important;
}
.el-breadcrumb__inner {
  border-radius: var(--app-radius-sm) !important;
}
.el-step__head {
  border-radius: 50% !important;
}
.el-step__icon {
  border-radius: 50% !important;
}
.el-step__line {
  border-radius: var(--app-radius-sm) !important;
}
.el-scrollbar__bar {
  border-radius: var(--app-radius-sm) !important;
}
.el-scrollbar__thumb {
  border-radius: var(--app-radius-sm) !important;
}
.el-image {
  border-radius: var(--app-radius-sm) !important;
  overflow: hidden;
}
.el-avatar {
  border-radius: 50% !important;
}
.el-badge__content {
  border-radius: var(--app-radius-sm) !important;
}
.el-scrollbar__wrap {
  border-radius: var(--app-radius-sm) !important;
}

/* 自定义组件圆角统一 */
.page-toolbar,
.filter-bar,
.stats-bar {
  border-radius: var(--app-radius-base) var(--app-radius-base) 0 0 !important;
}
.page-toolbar + *,
.filter-bar + * {
  border-radius: 0 !important;
}
.unrecognized-bar {
  border-radius: 0 0 var(--app-radius-base) var(--app-radius-base) !important;
}
.log-toolbar {
  border-radius: var(--app-radius-base) var(--app-radius-base) 0 0 !important;
}
.log-collapsed-bar {
  border-radius: var(--app-radius-base) var(--app-radius-base) 0 0 !important;
}
.status-bar {
  border-radius: 0 0 var(--app-radius-base) var(--app-radius-base) !important;
}
.tab-bar {
  border-radius: var(--app-radius-base) var(--app-radius-base) 0 0 !important;
}
.result-wrapper {
  border-radius: var(--app-radius-base) !important;
  overflow: hidden;
}
.cmp-row {
  border-radius: var(--app-radius-sm) !important;
}
.check-rule-item,
.check-legend {
  border-radius: var(--app-radius-sm) !important;
}
.profile-row {
  border-radius: var(--app-radius-sm) !important;
}
.check-card {
  border-radius: var(--app-radius-sm) !important;
}
.save-form {
  border-radius: var(--app-radius-sm) !important;
}

/* Element Plus 苹果风格毛玻璃效果 */
.el-popper.is-dark:not([role='tooltip']),
.el-popper.is-light:not([role='tooltip']),
.el-dialog,
.el-drawer,
.el-dropdown-menu,
.el-popover.el-popper,
.el-message-box,
.el-message,
.el-notification,
.el-select-dropdown,
.el-picker-panel,
.el-loading-mask {
  background: var(--app-glass-bg) !important;
  border: 1px solid var(--app-glass-border) !important;
  border-radius: var(--app-radius-lg) !important;
  box-shadow: var(--app-glass-shadow) !important;
  backdrop-filter: blur(var(--app-glass-blur)) !important;
  -webkit-backdrop-filter: blur(var(--app-glass-blur)) !important;
}
.el-dialog {
  border-radius: var(--app-radius-xl) !important;
}
.el-drawer {
  border-left: 1px solid var(--app-glass-border) !important;
  box-shadow: var(--app-glass-shadow-lg) !important;
  border-radius: var(--app-radius-xl) 0 0 var(--app-radius-xl) !important;
}
.el-overlay.is-dark .el-dialog {
  background: var(--app-glass-overlay) !important;
  backdrop-filter: blur(var(--app-glass-blur-sm)) !important;
  -webkit-backdrop-filter: blur(var(--app-glass-blur-sm)) !important;
}
</style>

<style scoped>
.app-root {
  height: 100%;
  display: flex;
  background: var(--el-bg-color);
}
.sidebar {
  width: var(--app-sidebar-width);
  min-width: var(--app-sidebar-width);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
  background: var(--el-bg-color-overlay);
  border-right: 1px solid var(--el-border-color);
}
.sidebar-menu {
  flex: 1;
  border-right: none;
}
.content-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-width: 0;
}
.main-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}
.sidebar-footer {
  border-top: 1px solid var(--el-border-color);
  padding: 6px 8px;
  border-radius: var(--app-radius-base) var(--app-radius-base) 0 0;
}
.profile-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--app-radius-base);
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-primary);
  transition: background 0.2s;
}
.profile-trigger:hover {
  background: var(--el-fill-color-light);
}
.profile-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.profile-arrow {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.el-dropdown-menu .is-active {
  color: var(--el-color-primary);
  font-weight: 500;
}
</style>
