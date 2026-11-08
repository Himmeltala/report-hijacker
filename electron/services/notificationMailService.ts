/*
 * @Author: Himmeltala
 * @Date: 2026-11-08 18:18:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-08 18:18:00
 * @FilePath: \electron\services\notificationMailService.ts
 * @Description: 邮件通知服务：按设置里的 SMTP 配置把通知发送到指定邮箱，并提供测试邮件
 */

import { ipcMain } from 'electron'
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { buildMailOptions } from '@electron/services/mailConfig'
import type { MailSettingsSnapshot } from '@electron/services/mailConfig'
import type { AppSettings } from '@electron/services/settingsService'
import type { MailSendParams, MailSendResult } from '@/types/ipc'

// #region 常量

// 发件人显示名
const FROM_NAME = '日报工具'
// 连接与读写超时，避免 SMTP 无响应时界面一直等待
const CONNECTION_TIMEOUT_MS = 15000
const SOCKET_TIMEOUT_MS = 25000
// 错误信息截断长度，避免把整段 SMTP 报文塞进日志
const MAX_REASON_LENGTH = 200

// #endregion

// #region 辅助函数

/**
 * 从设置里读取邮件相关配置项
 * @param {AppSettings} settings 当前档案的设置实例
 * @returns {MailSettingsSnapshot} 邮件配置快照
 */
function readMailSettings(settings: AppSettings): MailSettingsSnapshot {
  return {
    smtpHost: settings.get<string>('mail.smtpHost', ''),
    smtpPort: settings.get<number>('mail.smtpPort', 465),
    secure: settings.get<boolean>('mail.secure', true),
    user: settings.get<string>('mail.user', ''),
    password: settings.get<string>('mail.password', ''),
    recipients: settings.get<string>('mail.recipients', ''),
  }
}

/**
 * 把异常信息压成一行并截断，便于直接展示在提示与日志里
 * @param {unknown} e 捕获到的异常
 * @returns {string} 截断后的错误描述
 */
function formatReason(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? '')
  const oneLine = raw.replace(/\s+/g, ' ').trim() || '发送失败，未返回原因'
  return oneLine.length > MAX_REASON_LENGTH ? `${oneLine.slice(0, MAX_REASON_LENGTH)}…` : oneLine
}

/**
 * 按当前配置发送一封纯文本邮件
 * @param {AppSettings} settings 当前档案的设置实例
 * @param {string} subject 邮件主题
 * @param {string} body 邮件正文
 * @returns {Promise<MailSendResult>} 发送结果，失败时带原因
 */
async function sendMail(settings: AppSettings, subject: string, body: string): Promise<MailSendResult> {
  const { options, error } = buildMailOptions(readMailSettings(settings))
  if (!options) return { success: false, reason: error }

  let transporter: Transporter | null = null
  try {
    transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: { user: options.user, pass: options.pass },
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      greetingTimeout: CONNECTION_TIMEOUT_MS,
      socketTimeout: SOCKET_TIMEOUT_MS,
    })
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${options.user}>`,
      to: options.recipients,
      subject,
      text: body || '',
    })
    return { success: true }
  } catch (e) {
    return { success: false, reason: formatReason(e) }
  } finally {
    transporter?.close()
  }
}

/**
 * 生成测试邮件的正文，带上当前发件账号与收件人，方便核对配置
 * @param {MailSettingsSnapshot} snapshot 邮件配置快照
 * @returns {string} 测试邮件正文
 */
function buildTestBody(snapshot: MailSettingsSnapshot): string {
  const recipients = (snapshot.recipients || '').trim() || '(未配置)'
  return [
    '如果你收到这封邮件，说明日报工具的邮件通知配置可以正常发信。',
    '',
    `发件邮箱：${snapshot.user || '(未配置)'}`,
    `收件邮箱：${recipients}`,
    `发送时间：${new Date().toLocaleString('zh-CN')}`,
  ].join('\n')
}

// #endregion

// #region IPC 注册

/**
 * 注册邮件通知 IPC
 * @param {object} deps 依赖项
 * @param {() => AppSettings} deps.getSettings 获取当前设置实例（档案切换后可能被替换）
 */
export function setupMailNotificationIpc(deps: { getSettings: () => AppSettings }): void {
  const { getSettings } = deps

  ipcMain.handle('mail:send', async (_e, params: MailSendParams) => {
    if (!params || !params.subject) return { success: false, reason: '缺少邮件主题' }
    return sendMail(getSettings(), params.subject, params.body)
  })

  // 测试邮件只校验配置与连通性，不受「启用邮件通知」开关影响
  ipcMain.handle('mail:test', async () => {
    const settings = getSettings()
    return sendMail(settings, '日报工具测试邮件', buildTestBody(readMailSettings(settings)))
  })
}

// #endregion
