/*
 * @Author: zhengrenfu
 * @Date: 2026-11-08 17:10:00
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-08 17:10:00
 * @FilePath: \src\types\settings.ts
 * @Description: 设置 schema 类型定义，assets/settings_schema.json 的结构契约
 */

// #region 设置项

/** 设置项控件类型，决定设置面板的渲染方式 */
export type SettingsFieldType =
  'checkbox' | 'text' | 'textarea' | 'combo' | 'spinbox' | 'regex' | 'prompts' | 'directories'

/** combo 设置的可选值 */
export interface SettingsOption {
  label: string
  value: string | number | boolean
}

/** 单个设置项 */
export interface SettingsField {
  // 点号分隔的完整键名，如 ai.enabled
  key: string
  label: string
  type: SettingsFieldType
  // 默认值，类型随控件而定
  default?: unknown
  description?: string
  placeholder?: string
  // 数值型设置的取值范围与步长
  min?: number
  max?: number
  step?: number
  suffix?: string
  // 下拉型设置的可选值
  options?: SettingsOption[]
  // 显示依赖：依赖项取值等于 depends_value 时展示，depends_value 缺省为 true
  depends_on?: string
  depends_value?: unknown
}

// #endregion

// #region 设置分组与分类

/** 设置分组，面板中渲染为一个小节 */
export interface SettingsGroup {
  label: string
  settings: SettingsField[]
}

/** 设置分类，面板左侧菜单的一项 */
export interface SettingsCategory {
  key: string
  label: string
  groups: SettingsGroup[]
}

/** 完整的设置 schema，与 settings_schema.json 一一对应 */
export type SettingsSchema = SettingsCategory[]

// #endregion
