<!--
 * @Author: zhengrenfu
 * @Date: 2026-07-14 22:29:28
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-07-14 22:29:28
 * @FilePath: \src\views\Settings\components\RegexTester.vue
 * @Description: 描述
-->

<template>
  <div class="regex-tester">
    <div class="tester-row">
      <div class="tester-field">
        <label class="tester-label">正则表达式</label>
        <el-input
          :model-value="regex"
          @input="$emit('update:regex', $event)"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          placeholder="输入正则，使用 (?&lt;name&gt;...) 具名捕获组"
        />
        <div v-if="missingGroups.length" class="tester-warning">缺少具名组：{{ missingGroups.join('、') }}</div>
      </div>
    </div>

    <div class="tester-row">
      <div class="tester-field">
        <label class="tester-label">测试文本</label>
        <el-input
          v-model="testText"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 6 }"
          placeholder="粘贴一行任务文本进行测试"
        />
      </div>
    </div>

    <div class="tester-actions">
      <el-button type="primary" @click="runTest" :disabled="!testText.trim() || !regex.trim()"> 测试解析 </el-button>
      <el-button @click="loadExample">填入示例</el-button>
    </div>

    <div v-if="testResult !== null" class="tester-result">
      <div v-if="testResult.error" class="result-fail">正则表达式无效：{{ testResult.error }}</div>
      <template v-else>
        <div v-if="testResult.matched" class="result-success">
          <div class="result-title">匹配成功，解析结果：</div>
          <div v-for="(val, key) in testResult.groups" :key="key" class="result-item">
            <span class="result-key">{{ labelMap[key] || key }}</span>
            <span class="result-val">{{ val || '(空)' }}</span>
          </div>
        </div>
        <div v-else class="result-fail">未匹配 — 该行文本不满足正则，会被归为「未识别行」</div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { EXPECTED_GROUPS, validateRegexGroups } from '@/utils/parser'

const props = defineProps<{ regex: string }>()
defineEmits<{ 'update:regex': [value: string] }>()

const testText = ref('')

const missingGroups = computed(() => validateRegexGroups(props.regex))

const labelMap: Record<string, string> = {
  seq: '序号',
  estimatedHours: '工时（第一个【】值）',
  projectName: '项目名称',
  remark: '备注',
  url: '任务链接',
  score: '工时（最后一个【】值）',
}

interface TestResult {
  matched: boolean
  groups: Record<string, string>
  error?: string
}

const testResult = ref<TestResult | null>(null)

function runTest() {
  try {
    const re = new RegExp(props.regex)
    const m = testText.value.match(re)
    if (m?.groups) {
      const groups: Record<string, string> = {}
      for (const key of EXPECTED_GROUPS) {
        groups[key] = m.groups[key] || ''
      }
      testResult.value = { matched: true, groups }
    } else {
      testResult.value = { matched: false, groups: {} }
    }
  } catch (e) {
    // 正则表达式本身非法，需与"未匹配"区分提示
    testResult.value = { matched: false, groups: {}, error: (e as Error).message }
  }
}

function loadExample() {
  testText.value = '1.【3.5】项目管理平台【后端-登录功能优化】https://xmgl.cdrunnet.com/work_packages/wp/12345【3.5】'
}
</script>

<style scoped>
.regex-tester {
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  padding: var(--app-space-3);
  background: var(--el-bg-color);
}
.tester-row {
  margin-bottom: var(--app-space-3);
}
.tester-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tester-label {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}
.tester-warning {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-color-danger);
  margin-top: 2px;
}
.tester-actions {
  display: flex;
  gap: 8px;
  margin-bottom: var(--app-space-3);
}
.tester-result {
  padding: var(--app-space-2);
  border-radius: var(--el-border-radius-base);
  font-size: var(--el-font-size-small);
}
.result-success {
  color: var(--el-color-success);
}
.result-title {
  font-weight: var(--el-font-weight-primary);
  margin-bottom: var(--app-space-1);
}
.result-item {
  display: flex;
  gap: 8px;
  padding: 2px 0;
  color: var(--el-text-color-primary);
}
.result-key {
  width: 100px;
  text-align: right;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}
.result-val {
  color: var(--el-text-color-primary);
  word-break: break-all;
}
.result-fail {
  color: var(--el-color-danger);
}
</style>
