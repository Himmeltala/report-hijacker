import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { AI_SETTING_KEYS } from '@/types/ai'

describe('AI_SETTING_KEYS', () => {
  it('每个键都能在 settings_schema.json 中找到', () => {
    const schema = JSON.parse(readFileSync(resolve(process.cwd(), 'assets/settings_schema.json'), 'utf-8'))
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
