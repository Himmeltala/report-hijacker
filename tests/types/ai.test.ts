/*
 * @Author: zhengrenfu
 * @Date: 2026-11-08
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-08 19:30:00
 * @FilePath: \tests\types\ai.test.ts
 * @Description: AI 设置键单测：键名与 settings_schema.json 保持一致
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { AI_SETTING_KEYS } from '@/types/ai'

describe('AI_SETTING_KEYS', () => {
  it('每个键都能在 settings_schema.json 中找到', () => {
    const schema = JSON.parse(readFileSync(resolve(process.cwd(), 'assets/settings/settings_schema.json'), 'utf-8'))
    const keys = new Set<string>()
    for (const category of schema) {
      for (const group of category.groups || []) {
        for (const setting of group.settings || []) keys.add(setting.key)
      }
    }
    for (const key of Object.values(AI_SETTING_KEYS)) {
      expect(keys.has(key), `settings_schema.json 缺少 ${key}`).toBe(true)
    }
  })
})
