<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14 01:34:53
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-08-04 12:14:04
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
                    <div v-else-if="setting.type === 'comment_rules'" class="rules-list-wrap">
                      <div class="rules-list">
                        <div v-for="(rule, i) in settingValues[setting.key] || []" :key="i" class="rule-item">
                          <el-switch v-model="rule.enabled" @change="onRulesChange(setting.key)" />
                          <el-input
                            v-model="rule.label"
                            placeholder="规则名称"
                            style="width: 100px"
                            @input="onRulesChange(setting.key)"
                          />
                          <el-input
                            v-model="rule.pattern"
                            placeholder="匹配文本或正则"
                            style="flex: 1"
                            @input="onRulesChange(setting.key)"
                          />
                          <el-switch
                            v-model="rule.isRegex"
                            :active-text="rule.isRegex ? '正则' : '文本'"
                            inline-prompt
                            style="--el-switch-on-color: var(--el-color-primary)"
                            @change="onRulesChange(setting.key)"
                          />
                          <el-select
                            v-model="rule.types"
                            multiple
                            collapse-tags
                            filterable
                            allow-create
                            default-first-option
                            placeholder="适用类型"
                            style="width: 140px"
                            @change="onRulesChange(setting.key)"
                          >
                            <el-option label="任务" value="任务" />
                            <el-option label="缺陷" value="缺陷" />
                          </el-select>
                          <el-button type="danger" text @click="removeRule(setting.key, i as number)">
                            <el-icon><Delete /></el-icon>
                          </el-button>
                        </div>
                      </div>
                      <el-button class="rules-add-btn" @click="addRule(setting.key)">
                        <el-icon><Plus /></el-icon> 添加规则
                      </el-button>
                    </div>
                    <div v-else-if="setting.type === 'check_rules'" class="rules-list-wrap">
                      <div class="check-legend">
                        <div class="check-legend-head" @click="legendOpen = !legendOpen">
                          <el-icon :class="{ 'icon-rotated': legendOpen }"><ArrowDown /></el-icon>
                          <span>配置字段说明</span>
                        </div>
                        <div v-if="legendOpen" class="check-legend-body">
                          <div class="legend-item">
                            <span class="legend-label">平台字段路径</span>
                            <span class="legend-desc"
                              >必须是平台 API
                              返回数据里的字段，实际值从平台取。常用：subject=任务标题、_embedded.status.name=任务状态、_embedded.project.name=项目名称、_embedded.responsible.name=处理人、estimatedTime=自评时长、customField105=预估时长、customField106=所属部门</span
                            >
                          </div>
                          <div class="legend-item">
                            <span class="legend-label">预期来源</span>
                            <span class="legend-desc"
                              >任务文本=用你粘贴文本里的值对比；设置值=用设置里填的值对比；平台自检=不设预期，只看平台字段本身</span
                            >
                          </div>
                          <div class="legend-item">
                            <span class="legend-label">比对方式</span>
                            <span class="legend-desc"
                              >全等=必须一模一样；大于/大于等于/小于/小于等于=数值逻辑比较；偏差小时=差值不超过容差；字段偏差=平台两个字段互相比；非空=字段填没填；白名单=值必须在列表里；多条件或=多条规则任一满足；多条件且=全部满足</span
                            >
                          </div>
                          <div class="legend-item">
                            <span class="legend-label">容差</span>
                            <span class="legend-desc">允许的最大偏差小时数，默认 3</span>
                          </div>
                          <div class="legend-item">
                            <span class="legend-label">对比字段</span>
                            <span class="legend-desc">字段偏差时，和主字段互相比的另一个平台字段</span>
                          </div>
                          <div class="legend-item">
                            <span class="legend-label">白名单</span>
                            <span class="legend-desc">逗号分隔可接受的值，如：待检查,已实现</span>
                          </div>
                          <div class="legend-item">
                            <span class="legend-label">匹配规则</span>
                            <span class="legend-desc">多条件规则：文本=包含即匹配；正则=按正则匹配</span>
                          </div>
                        </div>
                      </div>
                      <div class="rules-list">
                        <div v-for="(rule, i) in settingValues[setting.key] || []" :key="i" class="check-rule-item">
                          <div class="check-rule-head">
                            <el-switch v-model="rule.enabled" @change="onCheckRulesChange(setting.key)" />
                            <el-input
                              v-model="rule.label"
                              placeholder="检查名"
                              style="flex: 1"
                              @input="onCheckRulesChange(setting.key)"
                            />
                            <el-button text @click="rule.expanded = !rule.expanded">
                              <el-icon :class="{ 'icon-rotated': rule.expanded }"><ArrowDown /></el-icon>
                              参数
                            </el-button>
                            <el-button type="danger" text @click="removeCheckRule(setting.key, i as number)">
                              <el-icon><Delete /></el-icon>
                            </el-button>
                          </div>
                          <div v-if="rule.expanded" class="check-rule-body">
                            <el-form label-width="88px" class="check-rule-form">
                              <el-form-item label="平台字段">
                                <el-input
                                  v-model="rule.field"
                                  placeholder="如 subject 或 _embedded.status.name"
                                  @input="onCheckRulesChange(setting.key)"
                                />
                              </el-form-item>
                              <el-form-item label="对比来源">
                                <el-select
                                  v-model="rule.expected"
                                  style="width: 100%"
                                  @change="onCheckRulesChange(setting.key)"
                                >
                                  <el-option label="任务文本" value="text" />
                                  <el-option label="设置值" value="config" />
                                  <el-option label="平台自检" value="none" />
                                </el-select>
                              </el-form-item>
                              <el-form-item v-if="rule.expected === 'text'" label="对比字段">
                                <el-select
                                  v-model="rule.expectedKey"
                                  style="width: 100%"
                                  @change="onCheckRulesChange(setting.key)"
                                >
                                  <el-option
                                    v-for="opt in textFieldOptions"
                                    :key="opt.value"
                                    :label="opt.label"
                                    :value="opt.value"
                                  />
                                </el-select>
                              </el-form-item>
                              <el-form-item v-else-if="rule.expected === 'config'" label="对比字段">
                                <el-select
                                  v-model="rule.expectedKey"
                                  style="width: 100%"
                                  @change="onCheckRulesChange(setting.key)"
                                >
                                  <el-option
                                    v-for="opt in configFieldOptions"
                                    :key="opt.value"
                                    :label="opt.label"
                                    :value="opt.value"
                                  />
                                </el-select>
                              </el-form-item>
                              <el-form-item
                                v-if="rule.expected === 'none' && ['gt', 'gte', 'lt', 'lte'].includes(rule.compare)"
                                label="阈值"
                              >
                                <el-input
                                  v-model="rule.expectedKey"
                                  placeholder="数值，如 0.5"
                                  style="width: 100%"
                                  @input="onCheckRulesChange(setting.key)"
                                />
                              </el-form-item>
                              <el-form-item label="对比方式">
                                <el-select
                                  v-model="rule.compare"
                                  style="width: 100%"
                                  @change="onCheckRulesChange(setting.key)"
                                >
                                  <el-option
                                    v-for="opt in getCompareOptions(rule.expected)"
                                    :key="opt.value"
                                    :label="opt.label"
                                    :value="opt.value"
                                  />
                                </el-select>
                              </el-form-item>
                              <el-form-item
                                v-if="rule.compare === 'diff-hours' || rule.compare === 'field-diff'"
                                label="容差(小时)"
                              >
                                <el-input-number
                                  v-model="rule.tolerance"
                                  :min="0"
                                  :step="1"
                                  @change="onCheckRulesChange(setting.key)"
                                />
                              </el-form-item>
                              <el-form-item v-if="rule.compare === 'field-diff'" label="另一平台字段">
                                <el-input
                                  v-model="rule.compareField"
                                  placeholder="如 customField105"
                                  @input="onCheckRulesChange(setting.key)"
                                />
                              </el-form-item>
                              <el-form-item
                                v-if="rule.compare === 'regex-any' || rule.compare === 'regex-all'"
                                label="匹配模式"
                              >
                                <el-select
                                  v-model="rule.matchMode"
                                  style="width: 100%"
                                  @change="onCheckRulesChange(setting.key)"
                                >
                                  <el-option label="任一匹配(或)" value="any" />
                                  <el-option label="全部匹配(且)" value="all" />
                                </el-select>
                              </el-form-item>
                              <el-form-item v-if="rule.compare === 'list-any'" label="白名单">
                                <el-select
                                  v-model="rule.values"
                                  multiple
                                  filterable
                                  allow-create
                                  default-first-option
                                  placeholder="输入值后按回车添加"
                                  style="width: 100%"
                                  @change="onCheckRulesChange(setting.key)"
                                />
                              </el-form-item>
                              <el-form-item
                                v-if="rule.compare === 'regex-any' || rule.compare === 'regex-all'"
                                label="匹配规则"
                              >
                                <div class="check-sub-rules">
                                  <div v-for="(r, ri) in rule.rules || []" :key="ri" class="check-sub-rule">
                                    <el-switch v-model="r.enabled" @change="onCheckRulesChange(setting.key)" />
                                    <el-input
                                      v-model="r.label"
                                      placeholder="规则名称"
                                      style="width: 100px"
                                      @input="onCheckRulesChange(setting.key)"
                                    />
                                    <el-input
                                      v-model="r.pattern"
                                      placeholder="匹配文本或正则"
                                      style="flex: 1"
                                      @input="onCheckRulesChange(setting.key)"
                                    />
                                    <el-switch
                                      v-model="r.isRegex"
                                      active-text="正则"
                                      inactive-text="文本"
                                      inline-prompt
                                      style="--el-switch-on-color: var(--el-color-primary)"
                                      @change="onCheckRulesChange(setting.key)"
                                    />
                                    <el-button
                                      type="danger"
                                      text
                                      @click="removeCheckSubRule(setting.key, i as number, ri as number)"
                                    >
                                      <el-icon><Delete /></el-icon>
                                    </el-button>
                                  </div>
                                  <el-button class="rules-add-btn" @click="addCheckSubRule(setting.key, i as number)">
                                    <el-icon><Plus /></el-icon> 添加规则
                                  </el-button>
                                </div>
                              </el-form-item>
                              <el-form-item label="跳过任务类型">
                                <el-select
                                  v-model="rule.skipTypes"
                                  multiple
                                  filterable
                                  allow-create
                                  default-first-option
                                  placeholder="输入类型后按回车添加，留空不跳过"
                                  style="width: 100%"
                                  @change="onCheckRulesChange(setting.key)"
                                />
                              </el-form-item>
                            </el-form>
                          </div>
                        </div>
                      </div>
                      <el-button class="rules-add-btn" @click="addCheckRule(setting.key)">
                        <el-icon><Plus /></el-icon> 添加校验规则
                      </el-button>
                    </div>
                    <div v-if="setting.description" class="setting-desc">{{ setting.description }}</div>
                  </div>
                </div>
              </div>
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
import { ref, computed, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { Plus, Delete, ArrowDown } from '@element-plus/icons-vue'
import { useSettingsStore, SETTING_KEY_MAP_REVERSE } from '@/stores/settings.store'
import { useLogStore } from '@/stores/log.store'
import RegexTester from '@/components/RegexTester.vue'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const store = useSettingsStore()
const logStore = useLogStore()

const localVisible = ref(false)
const activeCategory = ref('connection')
const categories = ref<any[]>([])
const settingValues = ref<Record<string, any>>({})
const legendOpen = ref(false)

/** 文本任务字段选项：从 groupRegex 具名组与 parser 派生字段生成，标题与处理人由备注组拆分 */
const TEXT_FIELD_LABELS: Record<string, string> = {
  rawSeq: '序号',
  rawEstimatedHours: '预估工时',
  rawProjectName: '项目名称',
  rawTitle: '任务标题',
  rawHandler: '处理人',
  rawRemark: '备注',
  rawUrl: '任务链接',
  rawScore: '分数',
}
const textFieldOptions = computed(() => {
  const regexStr = String(settingValues.value['parsing.groupRegex'] || '')
  const names: string[] = []
  const re = /\(\?<([A-Za-z_]\w*)>/g
  let m
  while ((m = re.exec(regexStr))) {
    if (!names.includes(m[1])) names.push(m[1])
  }
  // 正则具名组映射为 raw 前缀字段
  const groupFields = names.map((n) => 'raw' + n.charAt(0).toUpperCase() + n.slice(1))
  // parser 派生字段：标题与处理人由备注组拆分，不是正则直接组
  const available = new Set([...groupFields, 'rawTitle', 'rawHandler'])
  const order = [
    'rawSeq',
    'rawEstimatedHours',
    'rawProjectName',
    'rawTitle',
    'rawHandler',
    'rawRemark',
    'rawUrl',
    'rawScore',
  ]
  const fields = order.filter((f) => available.has(f))
  if (fields.length === 0) {
    return [
      { label: '任务标题(rawTitle)', value: 'rawTitle' },
      { label: '项目名称(rawProjectName)', value: 'rawProjectName' },
      { label: '分数(rawScore)', value: 'rawScore' },
      { label: '任务链接(rawUrl)', value: 'rawUrl' },
    ]
  }
  return fields.map((f) => ({
    label: `${TEXT_FIELD_LABELS[f] || f}(${f})`,
    value: f,
  }))
})

/** 设置值来源的可对比配置项：从设置 schema 筛选标记了 compareCandidate 的设置项，值用完整设置键 */
const configFieldOptions = computed(() => {
  const options: Array<{ label: string; value: string }> = []
  for (const cat of categories.value) {
    for (const group of cat.groups || []) {
      for (const setting of group.settings || []) {
        if (setting.compareCandidate === true) {
          options.push({ label: `${setting.label}(配置)`, value: setting.key })
        }
      }
    }
  }
  return options
})

/**
 * 按对比来源返回适用的对比方式选项，自检（none）模式排除依赖外部预期值的 equals 与 diff-hours
 * @param {string} expected 对比来源：text、config、none
 * @returns {Array<{label: string, value: string}>} 适用选项列表
 */
function getCompareOptions(expected: string): Array<{ label: string; value: string }> {
  const all: Array<{ label: string; value: string }> = [
    { label: '全等', value: 'equals' },
    { label: '大于', value: 'gt' },
    { label: '大于等于', value: 'gte' },
    { label: '小于', value: 'lt' },
    { label: '小于等于', value: 'lte' },
    { label: '偏差小时', value: 'diff-hours' },
    { label: '字段偏差', value: 'field-diff' },
    { label: '非空', value: 'non-empty' },
    { label: '白名单', value: 'list-any' },
    { label: '多条件或', value: 'regex-any' },
    { label: '多条件且', value: 'regex-all' },
  ]
  if (expected === 'none') {
    // 自检无外部预期值：排除依赖外部值的 equals 与 diff-hours，数值比较的阈值取自 expectedKey
    return all.filter((o) => !['equals', 'diff-hours'].includes(o.value))
  }
  return all
}

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
    // 校验规则落盘前剔除 UI 辅助字段
    if (key === 'validation.checkRules' && Array.isArray(raw)) {
      for (const r of raw) {
        delete r.expanded
      }
    }
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

/** 将日志面板设置同步到日志 store 即时生效，导入或重置后同样需要同步，避免行数与高度停留旧值 */
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

function addRule(key: string) {
  const rules: any[] = settingValues.value[key] || []
  rules.push({ enabled: true, label: '', pattern: '', isRegex: false })
  settingValues.value[key] = [...rules]
  onChange(key, rules)
}

function removeRule(key: string, index: number) {
  const rules: any[] = [...(settingValues.value[key] || [])]
  rules.splice(index, 1)
  settingValues.value[key] = rules
  onChange(key, rules)
}

async function onRulesChange(key: string) {
  const rules = settingValues.value[key] || []
  for (const rule of rules) {
    if (rule.enabled && rule.isRegex && rule.pattern) {
      try {
        new RegExp(rule.pattern)
      } catch (e) {
        logStore.addLog('error', `规则「${rule.label || rule.pattern}」的正则无效: ${(e as Error).message}`)
        return
      }
    }
  }
  await onChange(key, rules)
}

function addCheckRule(key: string) {
  const rules: any[] = settingValues.value[key] || []
  rules.push({
    enabled: true,
    label: '',
    field: 'subject',
    expected: 'text',
    expectedKey: 'rawTitle',
    compare: 'equals',
  })
  settingValues.value[key] = [...rules]
  onChange(key, rules)
}

function removeCheckRule(key: string, index: number) {
  const rules: any[] = [...(settingValues.value[key] || [])]
  rules.splice(index, 1)
  settingValues.value[key] = rules
  onChange(key, rules)
}

async function onCheckRulesChange(key: string) {
  const rules = settingValues.value[key] || []
  for (const rule of rules) {
    // 自检模式清理依赖外部预期值的 equals 与 diff-hours，数值比较用 expectedKey 阈值，不受影响
    if (rule.expected === 'none' && ['equals', 'diff-hours'].includes(rule.compare)) {
      rule.compare = 'non-empty'
    }
  }
  await onChange(key, rules)
}

function addCheckSubRule(key: string, ruleIndex: number) {
  const rules: any[] = settingValues.value[key] || []
  const rule = rules[ruleIndex]
  if (!rule) return
  if (!rule.rules) rule.rules = []
  rule.rules.push({ enabled: true, label: '', pattern: '', isRegex: false })
  settingValues.value[key] = [...rules]
  onChange(key, rules)
}

function removeCheckSubRule(key: string, ruleIndex: number, subIndex: number) {
  const rules: any[] = [...(settingValues.value[key] || [])]
  const rule = rules[ruleIndex]
  if (!rule) return
  rule.rules = [...(rule.rules || [])]
  rule.rules.splice(subIndex, 1)
  settingValues.value[key] = rules
  onChange(key, rules)
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
