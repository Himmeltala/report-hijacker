/*
 * @Author: zhengrenfu
 * @Date: 2026-11-08
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-08 19:30:00
 * @FilePath: \tests\services\ai\toolLoop.test.ts
 * @Description: 通用工具循环单测：多轮工具调用、思考过程回填与轮数上限
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiChatToolCall } from '@/types/ai'

vi.mock('@/services/ai/chat', () => ({ aiChat: vi.fn() }))

import { aiChat } from '@/services/ai/chat'
import { isToolsUnsupportedError, runToolLoop } from '@/services/ai/toolLoop'

const mockChat = vi.mocked(aiChat)

function toolCall(id: string, name = 'aux_prompt_1'): AiChatToolCall {
  return { id, type: 'function', function: { name, arguments: '{"input":"步骤"}' } }
}

beforeEach(() => {
  mockChat.mockReset()
})

describe('runToolLoop', () => {
  it('无工具调用时直接返回文本与思考过程', async () => {
    mockChat.mockResolvedValueOnce({ text: '结论', reasoning: '思考' })
    const result = await runToolLoop({ prompt: 'P', tools: [], execute: vi.fn() })
    expect(result).toEqual({ conclusion: '结论', reasoning: '思考' })
    expect(mockChat).toHaveBeenCalledWith({ messages: [{ role: 'user', content: 'P' }], tools: [] })
  })

  it('追加 instruction 到用户消息末尾', async () => {
    mockChat.mockResolvedValueOnce({ text: '结论', reasoning: '' })
    await runToolLoop({ prompt: 'P', tools: [], instruction: 'I', execute: vi.fn() })
    expect(mockChat).toHaveBeenCalledWith({ messages: [{ role: 'user', content: 'P\n\nI' }], tools: [] })
  })

  it('回填工具结果后继续请求，并拼接各轮思考过程', async () => {
    const call = toolCall('c1')
    mockChat
      .mockResolvedValueOnce({ text: '', reasoning: 'r1', toolCalls: [call] })
      .mockResolvedValueOnce({ text: '最终结论', reasoning: 'r2' })
    const execute = vi.fn().mockResolvedValue('工具结果')

    const result = await runToolLoop({ prompt: 'P', tools: [], execute })

    expect(execute).toHaveBeenCalledWith(call)
    expect(result).toEqual({ conclusion: '最终结论', reasoning: 'r1\n\nr2' })
    expect(mockChat).toHaveBeenNthCalledWith(2, {
      messages: [
        { role: 'user', content: 'P' },
        { role: 'assistant', content: '', tool_calls: [call] },
        { role: 'tool', tool_call_id: 'c1', content: '工具结果' },
      ],
      tools: [],
    })
  })

  it('超过轮数上限时抛出与原来一致的错误', async () => {
    mockChat.mockResolvedValue({ text: '', reasoning: '', toolCalls: [toolCall('c1')] })
    await expect(runToolLoop({ prompt: 'P', tools: [], execute: vi.fn(), maxRounds: 2 })).rejects.toThrow(
      'AI 审查超过 2 轮工具调用，已中止',
    )
  })
})

describe('isToolsUnsupportedError', () => {
  it('识别 HTTP 4xx 且提到工具/不支持的错误', () => {
    expect(isToolsUnsupportedError(new Error('AI 接口返回 HTTP 400: tools not supported'))).toBe(true)
  })

  it('HTTP 5xx 或无关错误不识别为不支持工具', () => {
    expect(isToolsUnsupportedError(new Error('AI 接口返回 HTTP 500: tools not supported'))).toBe(false)
    expect(isToolsUnsupportedError(new Error('network error'))).toBe(false)
  })
})
