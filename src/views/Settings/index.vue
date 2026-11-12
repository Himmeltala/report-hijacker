<!--
 * @Author: zhengrenfu
 * @Date: 2026-11-11 23:50:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-12 11:05:00
 * @FilePath: \src\views\Settings\index.vue
 * @Description: 设置页面，左侧菜单支持二级页面，系统通知与邮件通知归入通知设置，AI 额外挂用量统计
-->

<template>
  <div class="page-settings">
    <div class="page-toolbar">
      <div class="toolbar-actions">
        <el-button @click="handleExport">
          <el-icon><Upload /></el-icon>导出设置
        </el-button>
        <el-button @click="handleImport">
          <el-icon><Download /></el-icon>导入设置
        </el-button>
        <el-divider direction="vertical" />
        <el-button type="danger" plain @click="handleReset">
          <el-icon><RefreshLeft /></el-icon>重置默认值
        </el-button>
      </div>
    </div>

    <div class="settings-body">
      <div class="settings-menu">
        <!-- 二级菜单展开收起会改变菜单宽度，固定住避免抖动 -->
        <el-scrollbar class="settings-nav" :style="{ width: menuWidth }">
          <el-menu :default-active="activeTab" :default-openeds="defaultOpeneds" @select="onMenuSelect">
            <template v-for="menu in menuItems" :key="menu.key">
              <el-sub-menu v-if="menu.subs.length" :index="menu.key">
                <template #title>{{ menu.label }}</template>
                <el-menu-item v-for="sub in menu.subs" :key="sub.key" :index="sub.key">
                  {{ sub.label }}
                </el-menu-item>
              </el-sub-menu>
              <el-menu-item v-else :index="menu.key">{{ menu.label }}</el-menu-item>
            </template>
          </el-menu>
        </el-scrollbar>
      </div>
      <el-scrollbar class="settings-content">
        <div class="settings-inner">
          <template v-for="menu in menuItems" :key="menu.key">
            <div v-if="menu.key === activeMenu?.key" class="settings-panel">
              <!-- 页面标题与菜单项同名时不再重复显示 -->
              <div v-if="activePanelTitle !== activeLabel" class="settings-head">
                <h2>{{ activePanelTitle }}</h2>
              </div>
              <!-- 二级页面只渲染自己的设置分组，用量统计这类页面完全由组件自渲染 -->
              <template v-if="!isExtraPage">
                <div v-for="group in currentGroups" :key="group.label" class="settings-group">
                  <h3 v-if="group.label">{{ group.label }}</h3>
                  <div
                    v-for="setting in group.settings"
                    :key="setting.key"
                    class="setting-row"
                    v-show="isVisible(setting)"
                  >
                    <label>{{ setting.label }}</label>
                    <div class="setting-control">
                      <el-switch
                        v-if="setting.type === 'checkbox'"
                        v-model="settingValues[setting.key]"
                        @change="onChange(setting.key, $event)"
                      />
                      <el-input
                        v-else-if="setting.type === 'text'"
                        v-model="settingValues[setting.key]"
                        :placeholder="setting.placeholder"
                        @blur="onChange(setting.key, settingValues[setting.key])"
                        :type="setting.key === 'connection.cookie' ? 'textarea' : 'text'"
                        :autosize="setting.key === 'connection.cookie' ? { minRows: 2, maxRows: 4 } : undefined"
                      />
                      <el-input
                        v-else-if="setting.type === 'textarea'"
                        v-model="settingValues[setting.key]"
                        :placeholder="setting.placeholder"
                        type="textarea"
                        :autosize="{ minRows: 3, maxRows: 8 }"
                        @blur="onChange(setting.key, settingValues[setting.key])"
                      />
                      <el-select
                        v-else-if="setting.type === 'combo'"
                        v-model="settingValues[setting.key]"
                        @change="onChange(setting.key, $event)"
                      >
                        <el-option
                          v-for="opt in setting.options"
                          :key="opt.value"
                          :label="opt.label"
                          :value="opt.value"
                        />
                      </el-select>
                      <div v-else-if="setting.type === 'spinbox'" class="spinbox-wrap">
                        <el-input-number
                          v-model="settingValues[setting.key]"
                          :min="setting.min"
                          :max="setting.max"
                          :step="setting.step"
                          @change="onChange(setting.key, $event)"
                        />
                        <span v-if="setting.suffix" class="spinbox-suffix">{{ setting.suffix }}</span>
                      </div>
                      <RegexTester
                        v-else-if="setting.type === 'regex'"
                        :regex="settingValues[setting.key] ?? setting.default"
                        @update:regex="onRegexChange(setting.key, $event)"
                      />
                      <div v-else-if="setting.type === 'prompts'" class="prompt-list-wrap">
                        <div v-for="(p, i) in promptItems(setting.key)" :key="i" class="prompt-item">
                          <div class="prompt-item-head">
                            <el-input
                              v-model="p.name"
                              class="prompt-name"
                              placeholder="提示词名称（如：流程图绘制）"
                              @blur="persistPrompts(setting.key)"
                            />
                            <el-button type="danger" text @click="removePrompt(setting.key, i)">删除</el-button>
                          </div>
                          <el-input
                            v-model="p.prompt"
                            type="textarea"
                            :autosize="{ minRows: 3, maxRows: 8 }"
                            placeholder="提示词内容"
                            @blur="persistPrompts(setting.key)"
                          />
                        </div>
                        <el-button class="prompts-add-btn" @click="addPrompt(setting.key)">
                          <el-icon><Plus /></el-icon> 新建提示词
                        </el-button>
                      </div>
                      <div v-else-if="setting.type === 'directories'" class="dir-list-wrap">
                        <div class="dir-list">
                          <div v-for="(dir, i) in settingValues[setting.key] || []" :key="i" class="dir-item">
                            <span class="dir-path">{{ dir }}</span>
                            <el-button type="danger" text @click="removeDir(setting.key, i as number)">删除</el-button>
                          </div>
                        </div>
                        <el-button class="dir-add-btn" @click="addDir(setting.key)">
                          <el-icon><Plus /></el-icon> 添加目录
                        </el-button>
                      </div>
                      <div v-if="setting.description" class="setting-desc">{{ setting.description }}</div>
                    </div>
                  </div>
                </div>
              </template>
              <MailTestPanel v-if="menu.cat === 'mail'" class="settings-extra" />
              <UpdatePanel v-if="menu.cat === 'update'" class="settings-extra" />
              <AiUsagePanel v-if="activeTab === 'ai:usage'" />
            </div>
          </template>
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Plus, Upload, Download, RefreshLeft } from '@element-plus/icons-vue'
import { useSettingsStore, SETTING_KEY_MAP_REVERSE } from '@/stores/settings.store'
import { useLogStore } from '@/stores/log.store'
import { getErrorMessage } from '@/utils/error'
import RegexTester from './components/RegexTester.vue'
import type { SettingsField, SettingsGroup, SettingsSchema } from '@/types/settings'
import UpdatePanel from './components/UpdatePanel.vue'
import MailTestPanel from './components/MailTestPanel.vue'
import AiUsagePanel from './components/AiUsagePanel.vue'

const store = useSettingsStore()
const logStore = useLogStore()

const categories = ref<SettingsSchema>([])
const settingValues = ref<Record<string, any>>({})

// 归入同一个一级菜单的分类，键为容纳它们的菜单键，值为归入的分类键
const GROUPED_CATS: Record<string, string[]> = {
  notification: ['notification', 'mail'],
}

// 分组容器菜单的名称，容器本身不直接显示设置，归入它的分类各自成为二级菜单
const GROUPED_LABELS: Record<string, string> = {
  notification: '通知设置',
}

// 一级菜单之外的子页面，内容不来自 schema 分组，由组件自己渲染
const EXTRA_SUBS: Record<string, { key: string; label: string; cat: string }[]> = {
  ai: [{ key: 'ai:usage', label: '用量统计', cat: 'ai' }],
}

// 下级菜单项，section 有值时只渲染来源分类里的该分组，base 表示分类自身的全部设置
interface MenuSub {
  key: string
  label: string
  cat: string
  section?: string
  base?: boolean
}

// 一级菜单项：归入分组容器的分类只作为容器出现，其余分类直接占一行
interface MenuItem {
  key: string
  label: string
  cat: string
  groups: SettingsGroup[]
  subs: MenuSub[]
}

// 由设置分类生成菜单，归入同一容器的分类合并成一项，各自成为它的二级菜单
const menuItems = computed<MenuItem[]>(() => {
  const list: MenuItem[] = []
  const containers: Record<string, MenuItem> = {}
  for (const cat of categories.value) {
    const owner = Object.keys(GROUPED_CATS).find((key) => GROUPED_CATS[key].includes(cat.key))
    if (owner) {
      if (!containers[owner]) {
        containers[owner] = {
          key: owner,
          label: GROUPED_LABELS[owner] || owner,
          cat: owner,
          groups: [],
          subs: [],
        }
        list.push(containers[owner])
      }
      // 一个分类对应一个页面，分组名与分类名一致时只取该分组，避免与页面标题重复
      // 子项名称取分类里的分组名，没有分组时用分类名
      const sub: MenuSub = {
        key: `${owner}:${cat.key}`,
        label: cat.groups.length ? cat.groups[0].label : cat.label,
        cat: cat.key,
      }
      // 分类只有一个分组时只渲染该分组，多个分组时整页渲染
      if (cat.groups.length === 1) sub.section = cat.groups[0].label
      containers[owner].subs.push(sub)
      continue
    }
    // 分类既有自身设置又有额外页面时，第一个子项给它的全部设置
    const extras = EXTRA_SUBS[cat.key] || []
    const subs: MenuSub[] = extras.length ? [{ key: cat.key, label: '基础设置', cat: cat.key, base: true }, ...extras] : []
    list.push({
      key: cat.key,
      label: cat.label,
      cat: cat.key,
      groups: cat.groups,
      subs,
    })
  }
  return list
})

// 当前页面的菜单键，一级项用分类键，二级页面用「分类:子项」
const activeTab = ref('connection')

// 当前页面所属的一级菜单项与子项，一级项自己没有子项
const activeMenu = computed(() => {
  const menu = menuItems.value.find((m) => m.key === activeTab.value)
  if (menu) return menu
  const parent = menuItems.value.find((m) => m.subs.some((sub) => sub.key === activeTab.value))
  return parent || menuItems.value[0]
})
const menuSub = computed<MenuSub | undefined>(() => activeMenu.value?.subs.find((sub) => sub.key === activeTab.value))

// 组件自渲染的页面，不渲染 schema 里的设置项
const isExtraPage = computed(() => !!menuSub.value && !menuSub.value.section && !menuSub.value.base)

// 当前页面在菜单里的名称
const activeLabel = computed(() => menuSub.value?.label || activeMenu.value?.label || '')

// 默认展开全部带子菜单的分类
const defaultOpeneds = computed(() => menuItems.value.filter((m) => m.subs.length).map((m) => m.key))

// 菜单宽度按最长的一级项推算，二级项缩进后的宽度加上箭头与内边距，展开收起都不变
const menuWidth = computed(() => {
  let longest = 0
  for (const menu of menuItems.value) longest = Math.max(longest, menu.label.length)
  return `${Math.max(140, longest * 15 + 112)}px`
})

// 当前页面要渲染的设置分组，二级页面只取它自己那一组
const currentGroups = computed<SettingsGroup[]>(() => {
  if (!menuSub.value) return activeMenu.value?.groups || []
  const source = categories.value.find((c) => c.key === menuSub.value?.cat)?.groups || []
  return menuSub.value.section ? source.filter((g) => g.label === menuSub.value?.section) : source
})

// 内容区标题跟随当前菜单项，一级项用它自己，二级项用子项名称
const activePanelTitle = computed(() => menuSub.value?.label || activeMenu.value?.label || '')

/**
 * 处理左侧菜单选择，选中的一级项没有自身设置时落到它的第一个子项
 * @param {string} key 菜单项索引
 */
function onMenuSelect(key: string): void {
  const menu = menuItems.value.find((m) => m.key === key)
  activeTab.value = menu && !menu.groups.length && menu.subs.length ? menu.subs[0].key : key
}

function isVisible(setting: SettingsField): boolean {
  if (!setting.depends_on) return true
  const parentVal = settingValues.value[setting.depends_on]
  const expected = setting.depends_value !== undefined ? setting.depends_value : true
  return parentVal === expected
}

onMounted(async () => {
  await loadSchema()
})

async function loadSchema() {
  try {
    const schema = await window.electron?.getSettingsSchema?.()
    if (schema && schema.length > 0) {
      categories.value = schema
    }
    const allSettings: Array<{ key: string; default: unknown }> = []
    for (const cat of categories.value) {
      for (const group of cat.groups) {
        for (const setting of group.settings) {
          allSettings.push({ key: setting.key, default: setting.default })
        }
      }
    }
    const values = await Promise.all(allSettings.map((s) => window.electron?.getSetting?.(s.key)))
    for (let i = 0; i < allSettings.length; i++) {
      const val = values[i]
      settingValues.value[allSettings[i].key] = val !== undefined && val !== null ? val : allSettings[i].default
    }
    // 同步到 Pinia store（将持久化键名转回 AppConfig 属性名）
    for (const [settingKey, val] of Object.entries(settingValues.value)) {
      const configKey = SETTING_KEY_MAP_REVERSE[settingKey]
      if (configKey && val !== undefined && val !== null) {
        ;(store.config as any)[configKey] = val
      }
    }
  } catch (e) {
    logStore.addLog('error', '设置配置加载失败: ' + getErrorMessage(e, String(e)))
  }
}

/**
 * 正则设置变更：校验合法后回写并持久化，非法正则拒绝保存，避免坏值落盘后解析全部失效
 * @param {string} key 设置键名
 * @param {string} value 正则表达式
 */
function onRegexChange(key: string, value: string) {
  try {
    new RegExp(value)
  } catch {
    logStore.addLog('error', '正则表达式不合法，已保留修改前的值')
    return
  }
  // 回写本地值，保证测试器即时反映输入内容
  settingValues.value[key] = value
  onChange(key, value)
}

async function onChange(key: string, value: any) {
  try {
    // 深拷贝避免 Vue reactive Proxy 无法被 Electron IPC 结构化克隆
    const raw = JSON.parse(JSON.stringify(value))
    await window.electron?.setSetting?.(key, raw)
    // 同步到 Pinia store（直接赋值，避免 updateConfig 重复持久化）
    const configKey = SETTING_KEY_MAP_REVERSE[key]
    if (configKey) {
      ;(store.config as any)[configKey] = raw
    }
    // 日志面板相关设置修改后即时生效，无需重启
    syncLogStoreSettings()
  } catch (e) {
    logStore.addLog('error', '保存设置失败: ' + getErrorMessage(e))
  }
}

// 将日志面板设置同步到日志 store 即时生效，导入或重置后同样需要同步，避免行数与高度停留旧值
function syncLogStoreSettings() {
  const maxLines = settingValues.value['appearance.logMaxLines']
  if (maxLines !== undefined && maxLines !== null) {
    logStore.maxLines = Number(maxLines) || 500
  }
  const panelHeight = settingValues.value['appearance.logPanelHeight']
  if (panelHeight !== undefined && panelHeight !== null) {
    logStore.panelHeight = Number(panelHeight) || 200
  }
}

async function addDir(key: string) {
  const result = await window.electron?.openFile?.({ properties: ['openDirectory'] })
  if (result) {
    const dirs: string[] = settingValues.value[key] || []
    if (!dirs.includes(result)) {
      dirs.push(result)
      settingValues.value[key] = [...dirs]
      await onChange(key, dirs)
      logStore.addLog('success', '已添加备份目录')
    } else {
      logStore.addLog('info', '该目录已在列表中')
    }
  }
}

function removeDir(key: string, index: number) {
  const dirs: string[] = [...(settingValues.value[key] || [])]
  dirs.splice(index, 1)
  settingValues.value[key] = dirs
  onChange(key, dirs)
}

// #region AI 提示词列表

// 取提示词列表，缺失时初始化为空数组并保证响应式
function promptItems(key: string): { name: string; prompt: string }[] {
  let list = settingValues.value[key]
  if (!Array.isArray(list)) {
    list = []
    settingValues.value[key] = list
  }
  return list
}

function addPrompt(key: string) {
  const list = promptItems(key)
  list.push({ name: '', prompt: '' })
  onChange(key, [...list])
}

function removePrompt(key: string, index: number) {
  const list = promptItems(key)
  list.splice(index, 1)
  onChange(key, [...list])
}

// 名称或内容编辑后整体回写
function persistPrompts(key: string) {
  onChange(key, promptItems(key))
}

// #endregion

async function handleExport() {
  try {
    const ret = await window.electron?.exportSettings?.()
    if (ret?.success) {
      logStore.addLog('success', '设置已导出')
    }
  } catch {
    logStore.addLog('error', '导出失败')
  }
}

async function handleImport() {
  try {
    const ret = await window.electron?.importSettings?.()
    if (ret?.success) {
      logStore.addLog('success', '设置已导入，部分设置可能需要重启后生效')
      await loadSchema()
      syncLogStoreSettings()
    }
  } catch {
    logStore.addLog('error', '导入失败，请检查文件格式')
  }
}

async function handleReset() {
  try {
    await ElMessageBox.confirm('确定将所有设置重置为默认值？', '确认重置', {
      type: 'warning',
      confirmButtonText: '重置',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  const resetEntries: Array<{ key: string; def: unknown; configKey?: string }> = []
  for (const cat of categories.value) {
    for (const group of cat.groups) {
      for (const setting of group.settings) {
        const def = setting.default
        settingValues.value[setting.key] = def
        resetEntries.push({
          key: setting.key,
          def,
          configKey: SETTING_KEY_MAP_REVERSE[setting.key],
        })
      }
    }
  }
  await Promise.all(resetEntries.map((e) => window.electron?.setSetting?.(e.key, e.def)))
  for (const e of resetEntries) {
    if (e.configKey && e.def !== undefined && e.def !== null) {
      ;(store.config as any)[e.configKey] = e.def
    }
  }
  syncLogStoreSettings()
  logStore.addLog('success', '已重置为默认值')
}
</script>

<style scoped>
.page-settings {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
/* 工具栏与其余页面保持一致：同底色、同内边距 */
.page-toolbar {
  display: flex;
  align-items: center;
  gap: var(--app-gap-toolbar);
  padding: var(--app-padding-toolbar);
  background: var(--el-bg-color-overlay);
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
}
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: var(--app-gap-toolbar);
}
.settings-body {
  flex: 1;
  display: flex;
  min-height: 0;
  background: var(--el-bg-color-overlay);
}
/* 分类菜单跟随应用菜单样式，只留右侧分隔线 */
/* 菜单栏宽度由 menuWidth 给出，随最长的一级项变化 */
.settings-menu {
  flex-shrink: 0;
  border-right: 1px solid var(--el-border-color);
}
.settings-nav {
  height: 100%;
}
.settings-menu :deep(.el-menu) {
  padding: var(--app-space-1) 0;
  border-right: none;
  background: transparent;
}
.settings-menu :deep(.el-menu-item),
.settings-menu :deep(.el-sub-menu__title) {
  height: 40px;
  line-height: 40px;
}
/* 二级菜单项缩进对齐一级文字，去掉分组竖线 */
.settings-menu :deep(.el-sub-menu .el-menu-item) {
  padding-left: 44px !important;
}
.settings-menu :deep(.el-menu--inline) {
  background: transparent;
}
.settings-content {
  flex: 1;
  min-width: 0;
}
/* 设置项限宽，窗口拉宽时不至于一行拉得过长 */
.settings-inner {
  max-width: 880px;
  padding: var(--app-space-4) var(--app-space-5);
}
.settings-head {
  margin-bottom: var(--app-space-4);
}
.settings-head h2 {
  font-size: var(--el-font-size-large);
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.settings-group {
  margin-bottom: var(--app-space-5);
}
/* 分组标题弱化为小节标题，主色只留给当前分类标题 */
.settings-group h3 {
  font-size: var(--el-font-size-base);
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: var(--app-space-3);
  padding-bottom: var(--app-space-1);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.settings-extra {
  margin-bottom: var(--app-space-5);
}
.setting-row {
  display: flex;
  align-items: flex-start;
  gap: var(--app-space-3);
  margin-bottom: var(--app-space-3);
}
.setting-row label {
  width: 112px;
  text-align: right;
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-regular);
  line-height: 32px;
  flex-shrink: 0;
}
.setting-control {
  flex: 1;
  min-width: 0;
}
.setting-desc {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.spinbox-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}
.spinbox-suffix {
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.dir-list-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dir-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dir-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: var(--el-fill-color-light);
  border-radius: var(--app-radius-sm);
}
.dir-path {
  flex: 1;
  font-size: var(--el-font-size-small);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dir-add-btn {
  align-self: flex-start;
}
.prompt-list-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.prompt-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--app-radius-sm);
}
.prompt-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.prompt-name {
  width: 240px;
  flex-shrink: 0;
}
.prompts-add-btn {
  align-self: flex-start;
}
</style>
