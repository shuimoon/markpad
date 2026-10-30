const md = require('../.smoke/lib/markdown.js')
const hl = require('../.smoke/lib/highlight.js')
const code = require('../.smoke/lib/code.js')
const fmt = require('../.smoke/lib/format.js')
const samples = require('../.smoke/lib/samples.js')

let pass = 0
let fail = 0
function check(name, cond, detail) {
  if (cond) {
    pass++
    console.log('  ok   ' + name)
  } else {
    fail++
    console.log('  FAIL ' + name + (detail ? ' :: ' + detail : ''))
  }
}

const src = [
  '# 标题一',
  '',
  '一段**加粗**和*斜体*与`代码`，还有[链接](https://a.b)与！[图](x.png)',
  '',
  '## 标题二',
  '',
  '- [ ] 待办一',
  '- [x] 待办二',
  '- 普通项',
  '',
  '1. 第一',
  '2. 第二',
  '',
  '> 引用一段',
  '',
  '```js',
  'const a = 1',
  '```',
  '',
  '| 左 | 中 | 右 |',
  '| :--- | :---: | ---: |',
  '| 1 | 2 | 3 |',
  '',
  '---',
  '',
  '### 标题三',
].join('\n')

const blocks = md.parseBlocks(src)
const kinds = blocks.map((b) => b.kind)
console.log('blocks:', JSON.stringify(kinds))

check('heading level 1', blocks[0].kind === 'heading' && blocks[0].level === 1)
check('heading id sec-1', blocks[0].id === 'sec-1', blocks[0].id)
check('paragraph has inline formatting', blocks[1].kind === 'paragraph' && blocks[1].inlines.length > 4)
check('task list first item unchecked', blocks[3].kind === 'list' && blocks[3].items[0].checked === false)
check('task list second item checked', blocks[3].items[1].checked === true)
check('task list third item plain', blocks[3].items[2].checked === null)
check('ordered list starts at 1', blocks[4].kind === 'list' && blocks[4].ordered === true && blocks[4].start === 1)
check('quote parses nested block', blocks[5].kind === 'quote' && blocks[5].blocks.length === 1)
check('code block keeps language', blocks[6].kind === 'code' && blocks[6].lang === 'js' && blocks[6].code.includes('const a = 1'))
check('table alignments', blocks[7].kind === 'table' && blocks[7].aligns.join(',') === 'left,center,right', blocks[7].aligns && blocks[7].aligns.join(','))
check('table body rows', blocks[7].rows.length === 1 && blocks[7].rows[0].length === 3)
check('hr', blocks[8].kind === 'hr')
check('heading after hr is sec-2', blocks[9].kind === 'heading' && blocks[9].id === 'sec-3', blocks[9].id)

const inline = md.parseInline('**b** *i* `c` [l](u) ![a](p) ~~d~~')
check('inline kinds', inline.map((n) => n.kind).join(',') === 'strong,text,em,text,code,text,link,text,image,text,del', inline.map((n) => n.kind).join(','))
check('inline link href', inline.find((n) => n.kind === 'link').href === 'u')
check('inline image src', inline.find((n) => n.kind === 'image').src === 'p')

const outline = md.extractOutline(blocks)
check('outline has 3 headings', outline.length === 3, JSON.stringify(outline))
check('outline levels', outline.map((o) => o.level).join(',') === '1,2,3')
check('outline ids unique', new Set(outline.map((o) => o.id)).size === 3)

check('plainText drops marks', md.plainText(blocks[1].inlines).includes('加粗') && !md.plainText(blocks[1].inlines).includes('**'))

const fenced = md.parseBlocks('```\nplain\n```')
check('code without lang', fenced[0].kind === 'code' && fenced[0].lang === '')

const unclosed = md.parseBlocks('# a\n\n```js\nstill code')
check('unclosed fence still code', unclosed[1].kind === 'code')

const highlighted = hl.highlightMarkdown(src)
check('highlight returns html', highlighted.includes('tok-head'), highlighted.slice(0, 80))
check('highlight escapes html', !hl.highlightMarkdown('a < b > c').includes('<b>'))

const js = code.tokenizeCode("const s = 'x' // hi\nfunction f(a) { return 42 }", 'js')
const tk = js.map((t) => t.cls)
check('code tokens include keyword/string/comment/number', ['tk-key', 'tk-str', 'tk-com', 'tk-num'].every((c) => tk.includes(c)), tk.join(' '))
check('code token text preserved', js.map((t) => t.text).join('').replace(/\s+/g, ' ').trim().startsWith('const s'))
check('python-ish fallback safe', code.tokenizeCode('def f():\n  return 1', 'python').length > 0)

check('countWords cjk', fmt.countWords('你好世界 hello world') === 6, String(fmt.countWords('你好世界 hello world')))
check('readingMinutes >= 1', fmt.readingMinutes('x'.repeat(900)) >= 1)
check('deriveTitle from heading', fmt.deriveTitle('# 我的标题\n\n正文') === '我的标题', fmt.deriveTitle('# 我的标题\n\n正文'))
check('deriveTitle fallback', fmt.deriveTitle('', '未命名') === '未命名')
check('stripMarkdown', fmt.stripMarkdown('# T\n\n**粗** `c`') === 'T · 粗 c', fmt.stripMarkdown('# T\n\n**粗** `c`'))
check('formatDate today', fmt.formatDate(Date.now()) === fmt.formatDate(Date.now()))
check('wordLabel under 1000', fmt.wordLabel(999) === '999 字', fmt.wordLabel(999))
check('wordLabel over 1000', fmt.wordLabel(1234) === '1.2k 字', fmt.wordLabel(1234))

const docs = samples.buildSamples(1700000000000)
check('samples count 5', docs.length === 5, String(docs.length))
check('samples two pinned', docs.filter((d) => d.pinned).length === 2)
check('samples unique ids', new Set(docs.map((d) => d.id)).size === 5)
check('samples parse cleanly', docs.every((d) => md.parseBlocks(d.content).length > 0))

/* ---------- import pipeline ---------- */
const imp = require('../.smoke/lib/importers.js')
check('isImportableName accepts md/txt', imp.isImportableName('a.md') && imp.isImportableName('b.TXT'))
check('isImportableName rejects png', !imp.isImportableName('a.png'))
check('baseTitle from nested path', imp.baseTitle('笔记/读书/深度工作.md') === '深度工作', imp.baseTitle('笔记/读书/深度工作.md'))
check('baseTitle drops generic names', imp.baseTitle('index.md') === '', imp.baseTitle('index.md'))
check('normalizeText strips BOM and CRLF', imp.normalizeText('\uFEFFa\r\nb') === 'a\nb')

const existing = [{ id: 'x', title: 't', content: 'hello', createdAt: 0, updatedAt: 0, pinned: false }]
const merged = imp.mergeImportedFiles(existing, [
  { name: 'a.md', path: 'a.md', content: 'hello' },
  { name: 'b.md', path: 'b.md', content: 'world' },
  { name: 'c.md', path: 'c.md', content: '   ' },
  { name: 'd.md', path: 'dir/d.md', content: 'world' },
])
check('merge keeps only new content', merged.addedCount === 1, String(merged.addedCount))
check('merge counts skips', merged.skipped === 3, String(merged.skipped))
check('merge titles from file name', merged.added[0].title === 'b', merged.added[0].title)
check('merge keeps ids unique', merged.added[0].id !== 'x')
check('describeImport wording', imp.describeImport(merged) === '已导入 1 篇，跳过 3 篇', imp.describeImport(merged))
check('describeImport all duplicate', imp.describeImport({ added: [], addedCount: 0, skipped: 2, truncated: false }) === '这 2 篇已经在库里了')
check('describeImport empty', imp.describeImport({ added: [], addedCount: 0, skipped: 0, truncated: false }) === '没有可导入的内容')

const many = Array.from({ length: imp.MAX_IMPORT_FILES + 7 }, (_, i) => ({
  name: `f${i}.md`,
  path: `f${i}.md`,
  content: `body ${i}`,
}))
const capped = imp.mergeImportedFiles([], many)
check('merge caps file count', capped.addedCount === imp.MAX_IMPORT_FILES, String(capped.addedCount))
check('merge flags truncation', capped.truncated === true)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
