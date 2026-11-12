<!--
 * @Author: zhengrenfu
 * @Date: 2026-11-11 23:50:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-12 09:32:00
 * @FilePath: \src\views\Settings\index.vue
 * @Description: 设置页面，左侧分类菜单支持二级页面，AI 分类下挂用量统计
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
        <el-scrollbar>
          <el-menu :default-active="activeMenuKey" :default-openeds="['ai']" @select="onMenuSelect">
            <template v-for="cat in categories" :key="cat.key">
              <el-sub-menu v-if="subMenus[cat.key]" :index="cat.key">
                <template #title>{{ cat.label }}</template>
                <el-menu-item :index="cat.key">设置</el-menu-item>
                <el-menu-item v-for="sub in subMenus[cat.key]" :key="sub.key" :index="sub.key">
                  {{ sub.label }}
                </el-menu-item>
              </el-sub-menu>
              <el-menu-item v-else :index="cat.key">{{ cat.label }}</el-menu-item>
            </template>
          </el-menu>
        </el-scrollbar>
      </div>
      <el-scrollbar class="settings-content">
        <div class="settings-inner">
          <template v-for="cat in categories" :key="cat.key">
            <div v-if="cat.key === activeCategory" class="settings-panel">
              <div class="settings-head">
                <h2>{{ activePanelTitle }}</h2>
              </div>
              <!-- 用量统计只展示图表，不重复渲染分类下的设置项 -->
              <template v-if="activeSub === 'settings'">
                <div v-for="group in cat.groups" :key="group.label" class="settings-group">
                  <h3>{{ group.label }}</h3>
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
                <MailTestPanel v-if="cat.key === 'mail'" class="settings-extra" />
                <UpdatePanel v-if="cat.key === 'update'" class="settings-extra" />
              </template>
              <AiUsagePanel v-if="cat.key === 'ai' && activeSub === 'usage'" />
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
import type { SettingsField, SettingsSchema } from '@/types/settings'
import UpdatePanel from './components/UpdatePanel.vue'
import MailTestPanel from './components/MailTestPanel.vue'
import AiUsagePanel from './components/AiUsagePanel.vue'

const store = useSettingsStore()
const logStore = useLogStore()

const activeCategory = ref('connection')
// 二级菜单项，默认落在分类的「设置」上
const activeSub = ref('settings')
const categories = ref<SettingsSchema>([])
const settingValues = ref<Record<string, any>>({})

// 带二级菜单的分类，键为分类键名，值为额外挂载的页面
const subMenus = computed<Record<string, { key: string; label: string }[]>>(() => ({
  ai: [{ key: 'ai:usage', label: '用量统计' }],
}))

// 当前选中的菜单项，二级菜单项用「分类:子项」表示
const activeMenuKey = computed(() => (activeSub.value === 'settings' ? activeCategory.value : `${activeCategory.value}:${activeSub.value}`))

// 内容区标题，二级页面取子项名称
const activePanelTitle = computed(() => {
  const cat = categories.value.find((c) => c.key === activeCategory.value)
  if (!cat) return ''
  if (activeSub.value === 'settings') return cat.label
  return (subMenus.value[cat.key] || []).find((s) => s.key === activeMenuKey.value)?.label || cat.label
})

/**
 * 处理左侧菜单选择，二级菜单项切到对应子页面，一级菜单项回到「设置」
 * @param {string} key 菜单项索引
 */
function onMenuSelect(key: string): void {
  const [cat, sub] = key.split(':')
  activeCategory.value = cat
  activeSub.value = sub || 'settings'
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
.settings-menu {
  width: 160px;
  min-width: 160px;
  border-right: 1px solid var(--el-border-color);
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
