/*
 * @Author: zhengrenfu
 * @Date: 2026-11-08
 * @Description: AI 领域类型与设置键常量，主进程与渲染层共用，避免键名散落
 */

// #region 设置键

/**
 * AI 相关设置键统一入口
 *
 * 键名与 assets/settings_schema.json 保持一致；主进程读取连接配置、渲染层读取提示词时均引用这里
 */
export const AI_SETTING_KEYS = {
  enabled: 'ai.enabled',
  baseUrl: 'ai.baseUrl',
  apiKey: 'ai.apiKey',
  model: 'ai.model',
  timeoutSeconds: 'ai.timeoutSeconds',
  taskReviewPrompt: 'ai.taskReview.prompt',
  auxPrompts: 'ai.prompts',
} as const

/**
 * 设置里的一条辅助提示词
 *
 * 对应 settings_schema.json 中 ai.prompts 的数组项，name 仅用于工具描述展示
 */
export interface AiAuxPromptSetting {
  name?: string
  prompt?: string
}

// #endregion

// #region 对话契约

// 对话消息，支持多轮与工具调用回填（OpenAI 兼容格式）
export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  // 模型要求调用的工具
  tool_calls?: AiChatToolCall[]
  // 工具结果对应的调用 id
  tool_call_id?: string
}

export interface AiChatToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    // 参数为 JSON 字符串，由调用方解析
    arguments: string
  }
}

export interface AiChatTool {
  type: 'function'
  function: {
    name: string
    description?: string
    // JSON Schema 格式的参数定义
    parameters?: Record<string, unknown>
  }
}

export interface AiChatParams {
  // 单轮调用的最终提示词，与 messages 二选一
  prompt?: string
  // 多轮调用的完整消息列表，优先于 prompt
  messages?: AiChatMessage[]
  // 可用工具定义，不传时按纯文本对话
  tools?: AiChatTool[]
}

export interface AiChatResult {
  text: string
  reasoning?: string
  // 模型本轮要求调用的工具，为空表示对话结束
  toolCalls?: AiChatToolCall[]
}

// #endregion
