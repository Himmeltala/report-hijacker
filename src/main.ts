/*
 * @Author: zhengrenfu
 * @Date: 2026-11-04 10:28:53
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-05 10:20:09
 * @FilePath: /pros/self/report-hijacker/src/main.ts
 * @Description: 应用入口
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from '@/App.vue'
import router from '@/router'
import { useLogStore } from '@/stores/log.store'
import { useSettingsStore } from '@/stores/settings.store'

// #region 应用启动

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(ElementPlus, { locale: zhCn })
  app.use(router)

  // 先加载配置，再挂载应用 — 确保子组件 onMounted 时 cookie 已就绪
  const settingsStore = useSettingsStore(pinia)
  await settingsStore.loadConfig()

  // 保存原生 console.warn，避免后续 JSON.stringify 层对循环引用对象崩溃
  const nativeWarn = console.warn
  app.config.warnHandler = (msg, _instance, trace) => {
    nativeWarn(`[Vue warn] ${msg}${trace ? `\n${trace}` : ''}`)
  }

  app.config.errorHandler = (err, _instance, info) => {
    const logStore = useLogStore(pinia)
    const msg = err instanceof Error ? err.message : String(err)
    // 生产构建下 info 只是错误码，附带首个栈帧便于定位具体报错位置
    const frame = err instanceof Error ? (err.stack || '').split('\n')[1]?.trim() : ''
    logStore.addLog('error', `[Vue] ${msg}${info ? ` (${info})` : ''}${frame ? ` ${frame}` : ''}`)
  }

  app.mount('#app')
}

bootstrap()

// #endregion
