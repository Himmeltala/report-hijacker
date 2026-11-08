/*
 * @Author: zhengrenfu
 * @Date: 2026-11-08 16:13:08
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-08 18:40:00
 * @FilePath: \src\services\ai\promptTools.ts
 * @Description: 辅助提示词工具：把设置里的提示词注册成模型可调用的工具，并执行单次调用
 */

import { AI_SETTING_KEYS } from '@/types/ai'
import type { AiChatTool, AiChatToolCall } from '@/types/ai'
import { aiChat } from '@/services/ai/chat'
import { stripCodeFence } from '@/services/ai/prompt'
import { getErrorMessage } from '@/utils/error'

// #region 类型定义

// 设置里的一条辅助提示词，对应一个工具
export interface AuxPromptTool {
  name: string
  title: string
  prompt: string
}

// #endregion

// #region 加载与注册

/**
 * 读取设置里的辅助提示词，空白项跳过
 * @returns {Promise<AuxPromptTool[]>} 可注册为工具的辅助提示词
 */
export async function loadAuxPromptTools(): Promise<AuxPromptTool[]> {
  const raw = await window.electron.getSetting<unknown[]>(AI_SETTING_KEYS.auxPrompts)
  if (!Array.isArray(raw)) return []
  const tools: AuxPromptTool[] = []
  for (const item of raw) {
    const prompt = String((item as any)?.prompt ?? '').trim()
    if (!prompt) continue
    const title = String((item as any)?.name ?? '').trim() || `辅助提示词 ${tools.length + 1}`
    tools.push({ name: `aux_prompt_${tools.length + 1}`, title, prompt })
  }
  return tools
}

/**
 * 把辅助提示词注册成工具定义，参数统一为 input
 * @param {AuxPromptTool[]} tools 辅助提示词
 * @returns {AiChatTool[]} 工具定义
 */
export function buildToolDefs(tools: AuxPromptTool[]): AiChatTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: `${tool.title}：把需要处理的步骤或正文放进 input 参数，返回该提示词的处理结果；流程图类提示词返回 Mermaid 源码。`,
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: '按顺序排列的步骤或需要处理的正文' },
        },
        required: ['input'],
      },
    },
  }))
}

// #endregion

// #region 工具执行

/**
 * 把模型给出的内容填进辅助提示词：【步骤列表】之后的示例步骤整体替换
 * @param {string} template 辅助提示词模板
 * @param {string} input 模型传入的内容
 * @returns {string} 填好的提示词
 */
export function fillAuxPrompt(template: string, input: string): string {
  const marker = '【步骤列表】'
  const index = template.indexOf(marker)
  if (index >= 0) return `${template.slice(0, index + marker.length)}\n${input}`
  return `${template}\n\n${input}`
}

/**
 * 执行一次工具调用：按辅助提示词再请求一次，失败时把原因交回模型继续
 * @param {Map<string, AuxPromptTool>} toolMap 工具名到辅助提示词的映射
 * @param {AiChatToolCall} call 模型发起的工具调用
 * @returns {Promise<string>} 回填给模型的工具结果
 */
export async function runAuxTool(toolMap: Map<string, AuxPromptTool>, call: AiChatToolCall): Promise<string> {
  const tool = toolMap.get(call.function.name)
  if (!tool) return `工具 ${call.function.name} 不存在，请直接输出审查结论`
  let args: any = {}
  try {
    args = JSON.parse(call.function.arguments || '{}')
  } catch {
    args = {}
  }
  const input = String(args?.input ?? args?.steps ?? args?.content ?? '').trim()
  if (!input) return '缺少 input 参数，请把步骤放进 input 后重新调用'
  try {
    const { text } = await aiChat({ prompt: fillAuxPrompt(tool.prompt, input) })
    return stripCodeFence(text) || '工具没有返回内容'
  } catch (e) {
    return `工具执行失败：${getErrorMessage(e, String(e))}`
  }
}

// #endregion
