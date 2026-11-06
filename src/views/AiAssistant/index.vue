<!--
 * @Author: Himmeltala
 * @Date: 2026-11-06 08:50:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-06 08:50:00
 * @FilePath: \src\views\AiAssistant\index.vue
 * @Description: AI 助手页面 - 从设置中选取提示词，输入步骤等上下文后生成内容（mermaid 流程图可右键复制/导出）
 -->

<template>
  <div class="page-ai-assistant">
    <div class="page-toolbar">
      <div class="toolbar-actions">
        <el-select v-model="promptIndex" class="prompt-select" placeholder="选择提示词">
          <el-option
            v-for="(p, i) in prompts"
            :key="i"
            :label="p.name || `提示词 ${i + 1}`"
            :value="i"
          />
        </el-select>
        <el-button @click="loadPrompts">
          <el-icon><Refresh /></el-icon>刷新提示词
        </el-button>
        <el-divider direction="vertical" />
        <el-button type="primary" :loading="isGenerating" :disabled="!canGenerate" @click="handleGenerate">
          <el-icon v-if="!isGenerating"><MagicStick /></el-icon>生成
        </el-button>
        <el-button @click="handleClear">
          <el-icon><Delete /></el-icon>清空
        </el-button>
      </div>
    </div>

    <div class="input-area">
      <el-input
        v-model="inputText"
        type="textarea"
        :autosize="{ minRows: 5, maxRows: 12 }"
        placeholder="每行输入一个步骤，例如：&#10;需求确认&#10;方案设计与开发&#10;功能测试&#10;提交成果物"
      />
      <div class="setting-tip">提示词中的【步骤列表】段落会被替换为上面按编号排列的步骤；提示词在「设置 - AI - AI 提示词」中维护</div>
    </div>

    <div class="result-area">
      <el-scrollbar v-if="resultText" class="result-scroll">
        <div class="result-body">
          <MarkdownText :text="resultText" />
        </div>
      </el-scrollbar>
      <el-empty v-else description="生成结果会显示在这里，流程图支持右键复制/导出" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Refresh, MagicStick, Delete } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings.store'
import { useLogStore } from '@/stores/log.store'
import { aiChat } from '@/utils/ai'
import MarkdownText from '@/components/MarkdownText.vue'

// 设置中的 AI 提示词列表键
const PROMPTS_KEY = 'ai.prompts'

interface AiPrompt {
  name: string
  prompt: string
}

const store = useSettingsStore()
const logStore = useLogStore()

const prompts = ref<AiPrompt[]>([])
const promptIndex = ref(0)
const inputText = ref('')
const isGenerating = ref(false)
const resultText = ref('')

const canGenerate = computed(() => prompts.value.length > 0 && inputText.value.trim().length > 0)

/**
 * 从设置读取提示词列表
 */
async function loadPrompts() {
  try {
    const val = await window.electron.getSetting(PROMPTS_KEY)
    prompts.value = Array.isArray(val)
      ? val
          .filter((p: any) => p && (p.name || p.prompt))
          .map((p: any) => ({ name: String(p.name || ''), prompt: String(p.prompt || '') }))
      : []
    if (promptIndex.value >= prompts.value.length) promptIndex.value = 0
  } catch (e: any) {
    prompts.value = []
    logStore.addLog('error', '提示词列表加载失败: ' + (e?.message || e))
  }
}

/**
 * 把输入的步骤替换进提示词的【步骤列表】段落
 * 带编号的行先去掉行首编号再统一重排，避免 1. 1. 双重编号
 */
function buildPrompt(template: string, steps: string): string {
  const lines = steps
    .split('\n')
    .map((l) => l.trim().replace(/^\d+\s*[.、)．]\s*/, ''))
    .filter(Boolean)
  const numbered = lines.map((l, i) => `${i + 1}. ${l}`).join('\n')
  if (!numbered) return template
  const marker = '【步骤列表】'
  const idx = template.lastIndexOf(marker)
  if (idx === -1) return `${template.trim()}\n\n${marker}\n${numbered}`
  return `${template.slice(0, idx + marker.length)}\n${numbered}`
}

async function handleGenerate() {
  if (!store.config.aiEnabled) {
    logStore.addLog('warning', 'AI 审查未启用，请先在设置中开启')
    return
  }
  const p = prompts.value[promptIndex.value]
  if (!p || !p.prompt.trim()) {
    logStore.addLog('warning', '所选提示词为空，请到设置中维护提示词内容')
    return
  }
  if (!inputText.value.trim()) return

  isGenerating.value = true
  resultText.value = ''
  try {
    const prompt = buildPrompt(p.prompt, inputText.value)
    logStore.addLog('info', `AI 生成中（${p.name || '未命名提示词'}）...`)
    const { text, reasoning } = await aiChat(prompt)
    resultText.value = text
    if (reasoning) logStore.addLog('info', `AI 思考: ${reasoning}`)
    logStore.addLog('success', `AI 生成完成（${p.name || '未命名提示词'}）`)
  } catch (e: any) {
    logStore.addLog('error', 'AI 生成失败: ' + (e?.message || e))
  } finally {
    isGenerating.value = false
  }
}

function handleClear() {
  inputText.value = ''
  resultText.value = ''
  logStore.addLog('info', '已清空')
}

onMounted(() => {
  loadPrompts()
})
</script>

<style scoped>
.page-ai-assistant {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.page-toolbar {
  height: auto;
  padding: var(--app-padding-toolbar);
  background: var(--el-bg-color-overlay);
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
}
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: var(--app-gap-toolbar);
}
.prompt-select {
  width: 220px;
}
.input-area {
  padding: var(--app-space-2) var(--app-space-3);
  flex-shrink: 0;
}
.result-area {
  flex: 1;
  overflow: hidden;
  margin: 0 var(--app-space-3) var(--app-space-3);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--app-radius-base);
}
.result-scroll {
  height: 100%;
}
.result-body {
  padding: var(--app-space-2) var(--app-space-3);
}
.setting-tip {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  padding: 4px 2px 0;
}
</style>
