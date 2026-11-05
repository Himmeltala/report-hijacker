<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14 01:34:53
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 14:21:53
 * @FilePath: \src\modals\SettingsModal.vue
 * @Description: 设置弹窗
-->

<template>
  <el-dialog v-model="localVisible" title="设置" width="50vw" top="2vh" :close-on-click-modal="false">
    <div class="settings-layout">
      <el-menu :default-active="activeCategory" class="settings-menu" @select="activeCategory = $event">
        <el-menu-item v-for="cat in categories" :key="cat.key" :index="cat.key">
          {{ cat.label }}
        </el-menu-item>
      </el-menu>
      <div class="settings-content">
        <el-scrollbar style="max-height: 70vh">
          <template v-for="cat in categories" :key="cat.key">
            <div v-if="cat.key === activeCategory">
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
              <UpdatePanel v-if="cat.key === 'update'" />
            </div>
          </template>
        </el-scrollbar>
      </div>
    </div>
    <template #footer>
      <div class="footer-left">
        <el-button @click="handleExport">导出设置</el-button>
        <el-button @click="handleImport">导入设置</el-button>
      </div>
      <el-button type="danger" @click="handleReset">重置默认值</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useSettingsStore, SETTING_KEY_MAP_REVERSE } from '@/stores/settings.store'
import { useLogStore } from '@/stores/log.store'
import RegexTester from '@/components/RegexTester.vue'
import UpdatePanel from '@/components/UpdatePanel.vue'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const store = useSettingsStore()
const logStore = useLogStore()

const localVisible = ref(false)
const activeCategory = ref('connection')
const categories = ref<any[]>([])
const settingValues = ref<Record<string, any>>({})

function isVisible(setting: any): boolean {
  if (!setting.depends_on) return true
  const parentVal = settingValues.value[setting.depends_on]
  const expected = setting.depends_value !== undefined ? setting.depends_value : true
  return parentVal === expected
}

watch(
  () => props.visible,
  async (v) => {
    localVisible.value = v
    if (v) await loadSchema()
  },
)

watch(localVisible, (v) => {
  emit('update:visible', v)
})

async function loadSchema() {
  try {
    const schema = await window.electron?.getSettingsSchema?.()
    if (schema && schema.length > 0) {
      categories.value = schema
    }
    const allSettings: Array<{ key: string; default: any }> = []
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
  } catch (e: any) {
    logStore.addLog('error', '设置配置加载失败: ' + (e?.message || e))
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
  } catch (e: any) {
    logStore.addLog('error', '保存设置失败: ' + (e.message || ''))
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

  const resetEntries: Array<{ key: string; def: any; configKey?: string }> = []
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
.settings-layout {
  display: flex;
  gap: var(--app-space-5);
  min-height: 360px;
}
.settings-menu {
  width: 120px;
  background: transparent;
  border-right: 1px solid var(--el-border-color);
}
.settings-content {
  flex: 1;
}
.settings-group {
  margin-bottom: var(--app-space-5);
}
.settings-group h3 {
  font-size: var(--el-font-size-base);
  color: var(--el-color-primary);
  margin-bottom: 10px;
  padding-bottom: var(--app-space-1);
  border-bottom: 1px solid var(--el-border-color);
}
.setting-row {
  display: flex;
  align-items: flex-start;
  gap: var(--app-space-3);
  margin-bottom: var(--app-space-3);
}
.setting-row label {
  width: 100px;
  text-align: right;
  font-size: var(--el-font-size-small);
  padding-top: var(--app-space-1);
  flex-shrink: 0;
}
.setting-control {
  flex: 1;
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
.rules-list-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rules-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rule-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: var(--el-fill-color-light);
  border-radius: var(--app-radius-sm);
}
.rule-item .el-switch {
  flex-shrink: 0;
}
.rules-add-btn {
  align-self: flex-start;
}
.check-rule-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 6px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--app-radius-sm);
}
.check-rule-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.check-rule-body {
  padding: 4px 4px 0;
  border-top: 1px dashed var(--el-border-color-lighter);
}
.check-rule-form .el-form-item {
  margin-bottom: 8px;
}
.setting-tip {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  padding: 0 2px 4px;
}
.check-legend {
  margin-bottom: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--app-radius-sm);
  font-size: var(--el-font-size-extra-small);
}
.check-legend-head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  cursor: pointer;
  color: var(--el-text-color-primary);
  font-weight: var(--el-font-weight-primary);
}
.check-legend-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 6px 6px;
  border-top: 1px dashed var(--el-border-color-lighter);
}
.legend-item {
  display: flex;
  gap: 8px;
  line-height: 1.4;
}
.legend-label {
  min-width: 76px;
  color: var(--el-text-color-primary);
  font-weight: var(--el-font-weight-primary);
  white-space: nowrap;
}
.legend-desc {
  color: var(--el-text-color-secondary);
}
.check-sub-rules {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.check-sub-rule {
  display: flex;
  align-items: center;
  gap: 6px;
}
.icon-rotated {
  transform: rotate(180deg);
  transition: transform 0.2s;
}
.footer-left {
  float: left;
  display: flex;
  gap: 8px;
}
</style>
