/*
 * @Author: zhengrenfu
 * @Date: 2026-11-08
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-08 19:30:00
 * @FilePath: \tests\electron\services\aiClient.test.ts
 * @Description: 主进程 AI 客户端单测：消息与工具归一化、配置校验与请求构造
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings } from '@electron/services/settingsService'
import {
  buildChatRequest,
  loadAiConfig,
  requestChatCompletion,
  toMessages,
  toToolCalls,
  toTools,
  type AiConnectionConfig,
} from '@electron/services/aiClient'

function fakeSettings(values: Record<string, any>): AppSettings {
  return {
    get: (key: string, defaultVal?: any) => (key in values ? values[key] : defaultVal),
  } as unknown as AppSettings
}

function config(overrides: Partial<AiConnectionConfig> = {}): AiConnectionConfig {
  return { baseUrl: 'https://api.example.com/v1', apiKey: 'k', model: 'm', timeoutSec: 30, ...overrides }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('toMessages', () => {
  it('优先使用 messages', () => {
    const messages = [{ role: 'user' as const, content: 'm' }]
    expect(toMessages({ messages, prompt: 'p' })).toBe(messages)
  })

  it('没有 messages 时把 prompt 包装成 user 消息', () => {
    expect(toMessages({ prompt: ' p ' })).toEqual([{ role: 'user', content: ' p ' }])
  })

  it('提示词为空时返回空数组', () => {
    expect(toMessages({ prompt: '   ' })).toEqual([])
    expect(toMessages({})).toEqual([])
  })
})

describe('toTools / toToolCalls', () => {
  it('过滤缺少名称的工具', () => {
    expect(toTools([{ type: 'function', function: { name: 'a' } }, { type: 'other' }, { type: 'function' }])).toEqual([
      { type: 'function', function: { name: 'a' } },
    ])
    expect(toTools([])).toBeUndefined()
  })

  it('工具调用参数统一为 JSON 字符串', () => {
    expect(
      toToolCalls([
        { id: '1', function: { name: 'f', arguments: '{}' } },
        { id: '2', function: { name: 'g', arguments: { input: 'x' } } },
        { function: { name: 'no-id' } },
      ]),
    ).toEqual([
      { id: '1', type: 'function', function: { name: 'f', arguments: '{}' } },
      { id: '2', type: 'function', function: { name: 'g', arguments: '{"input":"x"}' } },
    ])
  })
})

describe('loadAiConfig', () => {
  it('未启用时抛出提示', () => {
    expect(() => loadAiConfig(fakeSettings({}))).toThrow('AI 未启用，请在设置中开启')
  })

  it('缺少连接字段时抛出对应提示', () => {
    const base = { 'ai.enabled': true, 'ai.baseUrl': 'https://a', 'ai.apiKey': 'k', 'ai.model': 'm' }
    expect(() => loadAiConfig(fakeSettings({ ...base, 'ai.baseUrl': '' }))).toThrow('未配置 AI 接口地址')
    expect(() => loadAiConfig(fakeSettings({ ...base, 'ai.apiKey': '' }))).toThrow('未配置 API 密钥')
    expect(() => loadAiConfig(fakeSettings({ ...base, 'ai.model': '' }))).toThrow('未配置模型名称')
  })

  it('去掉地址末尾斜杠，超时缺省为 300 秒', () => {
    const settings = fakeSettings({
      'ai.enabled': true,
      'ai.baseUrl': 'https://a/v1///',
      'ai.apiKey': ' k ',
      'ai.model': ' m ',
    })
    expect(loadAiConfig(settings)).toEqual({ baseUrl: 'https://a/v1', apiKey: 'k', model: 'm', timeoutSec: 300 })
  })
})

describe('buildChatRequest', () => {
  it('拼出 chat completions 请求，tools 仅在存在时携带', () => {
    const messages = [{ role: 'user' as const, content: 'hi' }]
    const req = buildChatRequest(config(), messages, {})
    expect(req.endpoint).toBe('https://api.example.com/v1/chat/completions')
    expect(req.headers.Authorization).toBe('Bearer k')
    expect(req.body).toEqual({ model: 'm', temperature: 0, messages })

    const withTools = buildChatRequest(config(), messages, {
      tools: [{ type: 'function', function: { name: 'f' } }],
    })
    expect((withTools.body as any).tools).toHaveLength(1)
  })
})

describe('requestChatCompletion', () => {
  it('归一化响应文本、思考过程与工具调用', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: ' 结论 ',
              reasoning_content: ' 思考 ',
              tool_calls: [{ id: '1', function: { name: 'f', arguments: '{}' } }],
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(requestChatCompletion(config(), [{ role: 'user', content: 'p' }], {})).resolves.toEqual({
      text: '结论',
      reasoning: '思考',
      toolCalls: [{ id: '1', type: 'function', function: { name: 'f', arguments: '{}' } }],
    })
  })

  it('HTTP 错误带状态码与截断后的响应体', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' }))
    await expect(requestChatCompletion(config(), [{ role: 'user', content: 'p' }], {})).rejects.toThrow(
      'AI 接口返回 HTTP 400: bad request',
    )
  })

  it('既无文本也无工具调用时报错', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{}] }) }))
    await expect(requestChatCompletion(config(), [{ role: 'user', content: 'p' }], {})).rejects.toThrow('AI 未返回内容')
  })

  it('超时时给出可操作的提示', async () => {
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout))
    await expect(
      requestChatCompletion(config({ timeoutSec: 30 }), [{ role: 'user', content: 'p' }], {}),
    ).rejects.toThrow('AI 接口请求超时（30 秒），可在设置里调大 AI 请求超时后重试')
  })
})
