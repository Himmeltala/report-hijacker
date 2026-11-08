/*
 * @Author: zhengrenfu
 * @Date: 2026-11-08
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-08 19:30:00
 * @FilePath: \tests\services\ai\promptTools.test.ts
 * @Description: 辅助提示词工具单测：工具注册、参数回填与执行结果处理
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiChatToolCall } from '@/types/ai'
import { AI_SETTING_KEYS } from '@/types/ai'

vi.mock('@/services/ai/chat', () => ({ aiChat: vi.fn() }))

import { aiChat } from '@/services/ai/chat'
import {
  buildToolDefs,
  fillAuxPrompt,
  loadAuxPromptTools,
  runAuxTool,
  type AuxPromptTool,
} from '@/services/ai/promptTools'

const mockChat = vi.mocked(aiChat)

function makeCall(name: string, args: string): AiChatToolCall {
  return { id: 'c1', type: 'function', function: { name, arguments: args } }
}

beforeEach(() => {
  mockChat.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadAuxPromptTools', () => {
  it('非数组返回空列表', async () => {
    vi.stubGlobal('window', { electron: { getSetting: vi.fn().mockResolvedValue(null) } })
    await expect(loadAuxPromptTools()).resolves.toEqual([])
  })

  it('跳过空白提示词，按序号命名', async () => {
    const getSetting = vi.fn().mockResolvedValue([
      { name: '', prompt: 'a' },
      { name: '空', prompt: '  ' },
      { name: 'B', prompt: 'c' },
    ])
    vi.stubGlobal('window', { electron: { getSetting } })

    await expect(loadAuxPromptTools()).resolves.toEqual([
      { name: 'aux_prompt_1', title: '辅助提示词 1', prompt: 'a' },
      { name: 'aux_prompt_2', title: 'B', prompt: 'c' },
    ])
    expect(getSetting).toHaveBeenCalledWith(AI_SETTING_KEYS.auxPrompts)
  })
})

describe('buildToolDefs', () => {
  it('每个辅助提示词生成一个 input 参数的工具', () => {
    const [tool] = buildToolDefs([{ name: 'aux_prompt_1', title: '流程图', prompt: 'p' }])
    expect(tool.function.name).toBe('aux_prompt_1')
    expect(tool.function.description).toContain('流程图')
    expect(tool.function.parameters).toEqual({
      type: 'object',
      properties: { input: { type: 'string', description: '按顺序排列的步骤或需要处理的正文' } },
      required: ['input'],
    })
  })
})

describe('fillAuxPrompt', () => {
  it('有【步骤列表】标记时替换标记后的示例步骤', () => {
    expect(fillAuxPrompt('规则\n【步骤列表】\n示例', '真实步骤')).toBe('规则\n【步骤列表】\n真实步骤')
  })

  it('无标记时追加在末尾', () => {
    expect(fillAuxPrompt('规则', '真实步骤')).toBe('规则\n\n真实步骤')
  })
})

describe('runAuxTool', () => {
  const tool: AuxPromptTool = { name: 'aux_prompt_1', title: 'T', prompt: '请画' }
  const toolMap = new Map([[tool.name, tool]])

  it('工具不存在时提示直接输出结论', async () => {
    await expect(runAuxTool(toolMap, makeCall('unknown', '{}'))).resolves.toBe(
      '工具 unknown 不存在，请直接输出审查结论',
    )
  })

  it('缺少 input 时返回参数提示', async () => {
    await expect(runAuxTool(toolMap, makeCall(tool.name, '{}'))).resolves.toBe(
      '缺少 input 参数，请把步骤放进 input 后重新调用',
    )
  })

  it('执行成功时去掉 Mermaid 围栏', async () => {
    mockChat.mockResolvedValueOnce({ text: '```mermaid\ngraph TD;\n```', reasoning: '' })
    await expect(runAuxTool(toolMap, makeCall(tool.name, '{"steps":"先做A"}'))).resolves.toBe('graph TD;')
    expect(mockChat).toHaveBeenCalledWith({ prompt: '请画\n\n先做A' })
  })

  it('执行失败时把原因交回模型', async () => {
    mockChat.mockRejectedValueOnce(new Error('超时'))
    await expect(runAuxTool(toolMap, makeCall(tool.name, '{"input":"x"}'))).resolves.toBe('工具执行失败：超时')
  })

  it('返回空内容时给出兜底提示', async () => {
    mockChat.mockResolvedValueOnce({ text: '', reasoning: '' })
    await expect(runAuxTool(toolMap, makeCall(tool.name, '{"input":"x"}'))).resolves.toBe('工具没有返回内容')
  })
})
