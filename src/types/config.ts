/*
 * @Author: zhengrenfu
 * @Date: 2026-07-16 01:08:14
 * @LastEditors: zhengrenfu
 * @LastEditTime: 2026-11-04 14:21:53
 * @FilePath: \src\types\config.ts
 * @Description: 应用配置类型定义
 */

// #region 应用配置

export interface AppConfig {
  cookie: string
  // 设置中的处理人，AI 审查比对用
  handlerName: string
  // 设置中的所属部门，AI 审查比对用
  departmentName: string
  taskRegex: string
  apiBaseUrl: string
  templatePath: string
  groupRegex: string
  // 是否启用 AI 审查（模型服务与提示词由主进程直接读设置，不走渲染层）
  aiEnabled: boolean
}

// #endregion
