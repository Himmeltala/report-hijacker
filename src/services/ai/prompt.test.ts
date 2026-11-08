import { describe, expect, it } from 'vitest'
import { fillPrompt, stripCodeFence, toPlainText } from '@/services/ai/prompt'

describe('fillPrompt', () => {
  it('替换占位符，空值写成 (空)', () => {
    expect(fillPrompt('标题：{title}，状态：{status}', { title: 'A', status: '' })).toBe('标题：A，状态：(空)')
  })

  it('同一占位符出现多次时全部替换', () => {
    expect(fillPrompt('{name}-{name}', { name: 'x' })).toBe('x-x')
  })

  it('未提供的占位符保持原样', () => {
    expect(fillPrompt('{a}{b}', { a: '1' })).toBe('1{b}')
  })
})

describe('toPlainText', () => {
  it('块级标签转行，图片保留占位', () => {
    expect(toPlainText('<p>你好<br>世界</p><img src="x" alt="流程图"><img src="y">')).toBe(
      '你好\n世界\n[图片:流程图][图片]',
    )
  })

  it('保留 @ 提及文本与 Markdown 图片占位', () => {
    expect(toPlainText('<mention data-text="张三"></mention> 完成 ![截图](http://a.png)')).toBe(
      '张三 完成 [图片:截图]',
    )
  })

  it('表格单元格与行转换为文本分隔', () => {
    expect(toPlainText('<table><tr><td>a</td><td>b</td></tr></table>')).toBe('a | b |')
  })

  it('还原常见 HTML 实体', () => {
    expect(toPlainText('a &lt;b&gt; &amp; c&nbsp;d')).toBe('a <b> & c d')
  })

  it('清理多余空行与首尾空白', () => {
    expect(toPlainText('\n\n<p>a</p>\n\n\n<p>b</p>\n\n')).toBe('a\n\nb')
  })
})

describe('stripCodeFence', () => {
  it('去掉完整代码围栏', () => {
    expect(stripCodeFence('```mermaid\ngraph TD;\nA-->B\n```')).toBe('graph TD;\nA-->B')
  })

  it('围栏未闭合时去掉开头行和末尾反引号', () => {
    expect(stripCodeFence('```js\nconst a = 1\n```')).toBe('const a = 1')
  })

  it('无围栏时原样返回去空白内容', () => {
    expect(stripCodeFence('  plain text  ')).toBe('plain text')
  })
})
