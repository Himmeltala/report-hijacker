/*
 * @Author: Himmeltala
 * @Date: 2026-11-08 18:22:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-08 18:22:00
 * @FilePath: \src\utils\notificationMail.ts
 * @Description: 邮件通知公共函数：按设置条件把通知发送到设置里指定的收件邮箱
 */

import { useLogStore } from '@/stores/log.store'
import { getErrorMessage } from '@/utils/error'

// #region 邮件通知

/**
 * 按设置条件发送邮件通知
 * @param {string} sceneKey 场景开关设置键，如 mail.onSyncCompleted
 * @param {string} subject 邮件主题
 * @param {string} body 邮件正文
 */
export async function maybeSendMailNotification(sceneKey: string, subject: string, body: string): Promise<void> {
  const logStore = useLogStore()
  try {
    const enabled = await window.electron.getSetting<boolean>('mail.enabled')
    if (!enabled) return
    if (!(await window.electron.getSetting<boolean>(sceneKey))) return
    // 邮件里补上发送时间，隔天再看也能对上操作时间
    const content = `${body}\n\n发送时间：${new Date().toLocaleString('zh-CN')}\n本邮件由日报工具自动发送，请勿直接回复。`
    const res = await window.electron.sendMailNotification({ subject, body: content })
    if (res.success) {
      logStore.addLog('info', `邮件通知已发送: ${subject}`)
    } else {
      logStore.addLog('warning', '邮件通知发送失败: ' + (res.reason || '未知原因'))
    }
  } catch (e) {
    logStore.addLog('warning', '邮件通知失败: ' + getErrorMessage(e))
  }
}

// #endregion
