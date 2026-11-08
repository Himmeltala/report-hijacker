/*
 * @Author: Himmeltala
 * @Date: 2026-11-08
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-08 18:30:00
 * @FilePath: \tests\electron\services\mailConfig.test.ts
 * @Description: 邮件通知配置单测：收件人解析与 SMTP 参数校验
 */

import { describe, expect, it } from 'vitest'
import { buildMailOptions, parseMailRecipients } from '@electron/services/mailConfig'

describe('parseMailRecipients', () => {
  it('支持中英文逗号、分号与空白分隔，并去掉空项', () => {
    expect(parseMailRecipients(' a@x.com, b@y.com；c@z.com d@w.com ')).toEqual([
      'a@x.com',
      'b@y.com',
      'c@z.com',
      'd@w.com',
    ])
  })

  it('重复邮箱只保留一个', () => {
    expect(parseMailRecipients('a@x.com;a@x.com， b@y.com')).toEqual(['a@x.com', 'b@y.com'])
  })

  it('空值与空白字符串返回空数组', () => {
    expect(parseMailRecipients('')).toEqual([])
    expect(parseMailRecipients(undefined)).toEqual([])
    expect(parseMailRecipients('   ')).toEqual([])
  })
})

describe('buildMailOptions', () => {
  const base = {
    smtpHost: 'smtp.qq.com',
    smtpPort: 465,
    secure: true,
    user: 'sender@qq.com',
    password: '授权码',
    recipients: 'a@x.com,b@y.com',
  }

  it('必填项齐全时组装出 SMTP 参数', () => {
    expect(buildMailOptions(base).options).toEqual({
      host: 'smtp.qq.com',
      port: 465,
      secure: true,
      user: 'sender@qq.com',
      pass: '授权码',
      recipients: ['a@x.com', 'b@y.com'],
    })
  })

  it('未开启 SSL 且未填端口时回落到 587', () => {
    const { options } = buildMailOptions({ ...base, secure: false, smtpPort: undefined })
    expect(options?.port).toBe(587)
    expect(options?.secure).toBe(false)
  })

  it('缺 SMTP 服务器时给出明确提示', () => {
    expect(buildMailOptions({ ...base, smtpHost: '  ' }).error).toBe('未配置 SMTP 服务器地址')
  })

  it('缺发件账号、密码、收件邮箱时逐项提示', () => {
    expect(buildMailOptions({ ...base, user: '' }).error).toBe('未配置发件邮箱账号')
    expect(buildMailOptions({ ...base, password: '' }).error).toBe('未配置邮箱密码或授权码')
    expect(buildMailOptions({ ...base, recipients: '' }).error).toBe('未配置收件邮箱')
  })

  it('端口为 0 时回落到默认端口', () => {
    expect(buildMailOptions({ ...base, smtpPort: 0 }).options?.port).toBe(465)
  })

  it('端口超出 1-65535 时判定不合法', () => {
    expect(buildMailOptions({ ...base, smtpPort: 70000 }).error).toBe('SMTP 端口不合法')
  })
})
