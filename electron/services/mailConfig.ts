/*
 * @Author: Himmeltala
 * @Date: 2026-11-08 18:15:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-08 18:15:00
 * @FilePath: \electron\services\mailConfig.ts
 * @Description: 邮件通知配置解析：把 mail.* 设置项组装成 SMTP 发信参数并校验完整性，纯函数便于单测
 */

// #region 类型定义

/** mail.* 设置项快照 */
export interface MailSettingsSnapshot {
  smtpHost?: string
  smtpPort?: number
  secure?: boolean
  user?: string
  password?: string
  recipients?: string
}

/** SMTP 发信参数 */
export interface MailOptions {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  recipients: string[]
}

/** 配置解析结果，options 与 error 二选一 */
export interface MailConfigResult {
  options?: MailOptions
  error?: string
}

// #endregion

// #region 配置解析

/**
 * 解析收件邮箱列表，支持中英文逗号、分号与空白分隔，自动去重并忽略空项
 * @param {string} raw 设置里填写的收件邮箱文本
 * @returns {string[]} 去重后的收件邮箱数组
 */
export function parseMailRecipients(raw: string | undefined): string[] {
  if (!raw) return []
  const list = String(raw)
    .split(/[,;，；\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  return Array.from(new Set(list))
}

/**
 * 由设置项组装 SMTP 发信参数，缺项时返回可直接展示的错误说明
 * @param {MailSettingsSnapshot} settings 邮件相关设置项
 * @returns {MailConfigResult} 配置齐全时给出 options，否则给出 error
 */
export function buildMailOptions(settings: MailSettingsSnapshot): MailConfigResult {
  const host = (settings.smtpHost || '').trim()
  const user = (settings.user || '').trim()
  const pass = settings.password || ''
  const recipients = parseMailRecipients(settings.recipients)
  const secure = settings.secure !== false
  const port = Number(settings.smtpPort) || (secure ? 465 : 587)

  if (!host) return { error: '未配置 SMTP 服务器地址' }
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { error: 'SMTP 端口不合法' }
  if (!user) return { error: '未配置发件邮箱账号' }
  if (!pass) return { error: '未配置邮箱密码或授权码' }
  if (!recipients.length) return { error: '未配置收件邮箱' }

  return { options: { host, port, secure, user, pass, recipients } }
}

// #endregion
