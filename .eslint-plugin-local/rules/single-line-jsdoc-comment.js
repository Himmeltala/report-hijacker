/*
 * @Author: Himmeltala
 * @Date: 2026-11-05 09:56:03
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-05 10:07:00
 * @FilePath: \.eslint-plugin-local\rules\single-line-jsdoc-comment.js
 * @Description: ESLint 规则：单行 JSDoc 块注释改用 //
 */

/*
 * 只处理内部符号：带 @ 标签、紧挨 export 声明、多行块注释都保留
 */

const hasExportAfter = (sourceCode, comment) => {
  const next = sourceCode.getTokenAfter(comment)
  return Boolean(next && next.value === 'export')
}

export default {
  meta: {
    type: 'layout',
    fixable: 'code',
    docs: { description: '单行 /** */ 注释改用 //' },
    messages: {
      singleLine: '单行块注释请用 // 代替 /** */',
    },
  },
  create(context) {
    const f = context.filename || ''
    if (!f.endsWith('.vue') && !f.endsWith('.js') && !f.endsWith('.mjs') && !f.endsWith('.ts')) return {}

    return {
      'Program:exit'() {
        const sourceCode = context.sourceCode
        const text = sourceCode.getText()

        for (const c of sourceCode.ast.comments || []) {
          if (c.type !== 'Block') continue
          // c.value 是 /* 与 */ 之间的内容，以 * 开头才是 JSDoc
          if (!c.value.startsWith('*')) continue
          if (c.loc.start.line !== c.loc.end.line) continue
          const content = c.value.replace(/^\*+/, '').trim()
          if (!content) continue
          // 带 @ 标签的是真 JSDoc
          if (content.includes('@')) continue
          // 注释描述的是对外符号，保留块注释
          if (hasExportAfter(sourceCode, c)) continue
          // 注释后面同一行还有代码，换成 // 会把代码注释掉
          const lineEnd = text.indexOf('\n', c.range[1])
          const rest = text.slice(c.range[1], lineEnd === -1 ? text.length : lineEnd)
          if (rest.trim()) continue

          context.report({
            node: sourceCode.ast,
            loc: c.loc,
            messageId: 'singleLine',
            fix: fixer => fixer.replaceText(c, `// ${content}`),
          })
        }
      },
    }
  },
}
