export interface CodeToken {
  text: string
  cls: string
}

interface LangDef {
  line?: string
  block?: [string, string]
  strings: string[]
  keywords: string[]
  hash?: boolean
}

const JS_KEYWORDS =
  'const let var function return if else for while do switch case break continue new class extends super this import export from default async await try catch finally throw typeof instanceof in of delete void yield static get set interface type enum implements readonly public private protected as satisfies keyof'.split(
    ' '
  )
const PY_KEYWORDS =
  'def class return if elif else for while import from as pass raise try except finally with lambda None True False and or not in is global nonlocal yield async await del assert'.split(
    ' '
  )
const SH_KEYWORDS = 'if then else fi for while do done case esac function return export local echo cd'.split(' ')

const LANGS: Record<string, LangDef> = {
  js: { line: '//', block: ['/*', '*/'], strings: ['`', '"', "'"], keywords: JS_KEYWORDS },
  json: { strings: ['"'], keywords: ['true', 'false', 'null'] },
  css: { block: ['/*', '*/'], strings: ['"', "'"], keywords: [] },
  html: { block: ['<!--', '-->'], strings: ['"', "'"], keywords: [] },
  py: { line: '#', strings: ['"""', "'''", '"', "'"], keywords: PY_KEYWORDS },
  sh: { line: '#', strings: ['"', "'"], keywords: SH_KEYWORDS },
}

LANGS.ts = LANGS.js
LANGS.tsx = LANGS.js
LANGS.jsx = LANGS.js
LANGS.typescript = LANGS.js
LANGS.javascript = LANGS.js
LANGS.python = LANGS.py
LANGS.bash = LANGS.sh
LANGS.shell = LANGS.sh
LANGS.jsonc = LANGS.js
LANGS.md = { strings: ['`'], keywords: [] }
LANGS.markdown = LANGS.md

const IDENT_START = /[A-Za-z_$]/
const IDENT = /[A-Za-z0-9_$]/

export function tokenizeCode(code: string, lang: string): CodeToken[] {
  const def = LANGS[(lang || '').toLowerCase()]
  if (!def) return [{ text: code, cls: '' }]

  const out: CodeToken[] = []
  let text = ''
  let i = 0

  const flush = () => {
    if (text) {
      out.push({ text, cls: '' })
      text = ''
    }
  }

  while (i < code.length) {
    const rest = code.slice(i)

    if (def.block && rest.startsWith(def.block[0])) {
      const end = code.indexOf(def.block[1], i + def.block[0].length)
      const stop = end < 0 ? code.length : end + def.block[1].length
      flush()
      out.push({ text: code.slice(i, stop), cls: 'tk-com' })
      i = stop
      continue
    }

    if (def.line && rest.startsWith(def.line)) {
      const end = code.indexOf('\n', i)
      const stop = end < 0 ? code.length : end
      flush()
      out.push({ text: code.slice(i, stop), cls: 'tk-com' })
      i = stop
      continue
    }

    const quote = def.strings.find((q) => rest.startsWith(q))
    if (quote) {
      let j = i + quote.length
      while (j < code.length) {
        if (code[j] === '\\') {
          j += 2
          continue
        }
        if (code.startsWith(quote, j)) {
          j += quote.length
          break
        }
        if (quote.length === 1 && code[j] === '\n') break
        j++
      }
      flush()
      out.push({ text: code.slice(i, j), cls: 'tk-str' })
      i = j
      continue
    }

    const ch = code[i]

    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(code[i + 1] ?? ''))) {
      let j = i + 1
      while (j < code.length && /[0-9a-fA-FxX._]/.test(code[j])) j++
      flush()
      out.push({ text: code.slice(i, j), cls: 'tk-num' })
      i = j
      continue
    }

    if (IDENT_START.test(ch)) {
      let j = i + 1
      while (j < code.length && IDENT.test(code[j])) j++
      const word = code.slice(i, j)
      flush()
      if (def.keywords.indexOf(word) >= 0) {
        out.push({ text: word, cls: 'tk-key' })
      } else {
        let k = j
        while (k < code.length && (code[k] === ' ' || code[k] === '\t')) k++
        out.push({ text: word, cls: code[k] === '(' ? 'tk-fn' : '' })
      }
      i = j
      continue
    }

    if (ch === '<' && (def === LANGS.html)) {
      const end = code.indexOf('>', i)
      const stop = end < 0 ? code.length : end + 1
      flush()
      out.push({ text: code.slice(i, stop), cls: 'tk-tag' })
      i = stop
      continue
    }

    text += ch
    i++
  }

  flush()
  return out
}
