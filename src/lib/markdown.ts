import type { OutlineItem } from '../types.js'

export type Align = 'left' | 'center' | 'right' | null

export type Inline =
  | { kind: 'text'; value: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'em'; children: Inline[] }
  | { kind: 'del'; children: Inline[] }
  | { kind: 'code'; value: string }
  | { kind: 'link'; href: string; children: Inline[] }
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'br' }

export interface ListItem {
  checked: boolean | null
  blocks: Block[]
}

export type Block =
  | { kind: 'heading'; level: number; inlines: Inline[]; text: string; id: string }
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'quote'; blocks: Block[] }
  | { kind: 'list'; ordered: boolean; start: number; items: ListItem[]; tight: boolean }
  | { kind: 'hr' }
  | { kind: 'table'; aligns: Align[]; head: Inline[][]; rows: Inline[][][] }

const PUNCT = '\\`*_{}[]()#+-.!~>|'

function isPunct(ch: string): boolean {
  return PUNCT.indexOf(ch) >= 0
}

function runLength(src: string, start: number, ch: string): number {
  let n = 0
  while (start + n < src.length && src[start + n] === ch) n++
  return n
}

/* ------------------------------------------------------------------ */
/* Inline                                                              */
/* ------------------------------------------------------------------ */

export function parseInline(src: string): Inline[] {
  const out: Inline[] = []
  let buf = ''
  let i = 0

  const flush = () => {
    if (buf) {
      out.push({ kind: 'text', value: buf })
      buf = ''
    }
  }

  while (i < src.length) {
    const ch = src[i]

    if (ch === '\\' && i + 1 < src.length && isPunct(src[i + 1])) {
      buf += src[i + 1]
      i += 2
      continue
    }

    if (ch === '\n') {
      flush()
      out.push({ kind: 'br' })
      i += 1
      continue
    }

    if (ch === '`') {
      const n = runLength(src, i, '`')
      const closing = findClosingRun(src, i + n, '`', n)
      if (closing > i + n) {
        flush()
        out.push({ kind: 'code', value: src.slice(i + n, closing).replace(/^ | $/g, '') })
        i = closing + n
        continue
      }
      buf += '`'.repeat(n)
      i += n
      continue
    }

    if (ch === '~' && src[i + 1] === '~') {
      const closing = src.indexOf('~~', i + 2)
      if (closing > i + 2) {
        flush()
        out.push({ kind: 'del', children: parseInline(src.slice(i + 2, closing)) })
        i = closing + 2
        continue
      }
      buf += '~~'
      i += 2
      continue
    }

    if (ch === '*' && src[i + 1] === '*') {
      const closing = src.indexOf('**', i + 2)
      if (closing > i + 2 && src[i + 2] !== ' ') {
        flush()
        out.push({ kind: 'strong', children: parseInline(src.slice(i + 2, closing)) })
        i = closing + 2
        continue
      }
      buf += '**'
      i += 2
      continue
    }

    if (ch === '*' || ch === '_') {
      const closing = findEmphasisClose(src, i + 1, ch)
      if (closing > i + 1 && src[i + 1] !== ' ') {
        flush()
        out.push({ kind: 'em', children: parseInline(src.slice(i + 1, closing)) })
        i = closing + 1
        continue
      }
      buf += ch
      i += 1
      continue
    }

    if (ch === '!' && src[i + 1] === '[') {
      const parsed = parseLinkLike(src, i + 1)
      if (parsed) {
        flush()
        out.push({ kind: 'image', alt: parsed.text, src: parsed.href })
        i = parsed.end
        continue
      }
    }

    if (ch === '[') {
      const parsed = parseLinkLike(src, i)
      if (parsed) {
        flush()
        out.push({ kind: 'link', href: parsed.href, children: parseInline(parsed.text) })
        i = parsed.end
        continue
      }
    }

    buf += ch
    i += 1
  }

  flush()
  return out
}

function findClosingRun(src: string, from: number, ch: string, n: number): number {
  let i = from
  while (i < src.length) {
    if (src[i] === ch && runLength(src, i, ch) >= n) return i
    i++
  }
  return -1
}

function findEmphasisClose(src: string, from: number, ch: string): number {
  let i = from
  while (i < src.length) {
    if (src[i] === ch) {
      if (src[i + 1] === ch) return -1
      return i
    }
    i++
  }
  return -1
}

function parseLinkLike(
  src: string,
  openBracket: number
): { text: string; href: string; end: number } | null {
  let depth = 0
  let i = openBracket
  for (; i < src.length; i++) {
    if (src[i] === '[') depth++
    else if (src[i] === ']') {
      depth--
      if (depth === 0) break
    }
  }
  if (i >= src.length || src[i + 1] !== '(') return null
  const text = src.slice(openBracket + 1, i)
  const hrefEnd = src.indexOf(')', i + 2)
  if (hrefEnd < 0) return null
  const href = src.slice(i + 2, hrefEnd).trim().split(/\s+/)[0] ?? ''
  return { text, href, end: hrefEnd + 1 }
}

/* ------------------------------------------------------------------ */
/* Blocks                                                              */
/* ------------------------------------------------------------------ */

export function parseBlocks(src: string): Block[] {
  let headingSeq = 0
  const lines = src.replace(/\r\n?/g, '\n').split('\n')

  const parseRange = (start: number, end: number): Block[] => {
    const blocks: Block[] = []
    let i = start

    while (i < end) {
      const line = lines[i]

      if (!line.trim()) {
        i++
        continue
      }

      // fenced code
      const fence = line.match(/^ {0,3}(`{3,}|~{3,})\s*([\w+#-]*)/)
      if (fence) {
        const marker = fence[1]
        const ch = marker[0]
        const size = marker.length
        const body: string[] = []
        i++
        while (i < end && !new RegExp(`^ {0,3}${ch === '`' ? '`' : '~'}{${size},}\\s*$`).test(lines[i])) {
          body.push(lines[i])
          i++
        }
        i++ // skip closing fence (or past end)
        blocks.push({ kind: 'code', lang: (fence[2] || '').toLowerCase(), code: body.join('\n') })
        continue
      }

      // hr
      if (/^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        blocks.push({ kind: 'hr' })
        i++
        continue
      }

      // atx heading
      const heading = line.match(/^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/)
      if (heading) {
        const level = heading[1].length
        const text = heading[2]
        headingSeq += 1
        blocks.push({
          kind: 'heading',
          level,
          text: plainText(parseInline(text)),
          inlines: parseInline(text),
          id: `sec-${headingSeq}`,
        })
        i++
        continue
      }

      // blockquote
      if (/^ {0,3}>/.test(line)) {
        const quoteLines: string[] = []
        while (i < end && (/^ {0,3}>/.test(lines[i]) || (quoteLines.length > 0 && lines[i].trim() === '' && /^ {0,3}>/.test(lines[i + 1] ?? '')))) {
          quoteLines.push(lines[i].replace(/^ {0,3}>\s?/, ''))
          i++
        }
        blocks.push({ kind: 'quote', blocks: parseNested(quoteLines) })
        continue
      }

      // table
      if (line.indexOf('|') >= 0 && isTableDivider(lines[i + 1] ?? '')) {
        const head = splitRow(line)
        const aligns = splitRow(lines[i + 1]).map(parseAlign)
        i += 2
        const rows: Inline[][][] = []
        while (i < end && lines[i].trim() && lines[i].indexOf('|') >= 0) {
          rows.push(splitRow(lines[i]).map((c) => parseInline(c)))
          i++
        }
        blocks.push({
          kind: 'table',
          aligns,
          head: head.map((c) => parseInline(c)),
          rows,
        })
        continue
      }

      // list
      const listMatch = line.match(/^(\s*)([-*+]|\d{1,9}[.)])\s+/)
      if (listMatch) {
        const baseIndent = listMatch[1].length
        const ordered = /\d/.test(listMatch[2])
        const start = ordered ? parseInt(listMatch[2], 10) : 1
        const items: ListItem[] = []
        let tight = true

        while (i < end) {
          const cur = lines[i]
          if (!cur.trim()) {
            const next = lines[i + 1] ?? ''
            const nextMatch = next.match(/^(\s*)([-*+]|\d{1,9}[.)])\s+/)
            if (nextMatch && nextMatch[1].length >= baseIndent && /\d/.test(nextMatch[2]) === ordered) {
              tight = false
              i++
              continue
            }
            break
          }
          const m = cur.match(/^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/)
          if (!m || m[1].length < baseIndent) break
          if (m[1].length > baseIndent + 1) break
          if (/\d/.test(m[2]) !== ordered) break

          const itemLines: string[] = [m[3]]
          i++
          while (i < end) {
            const cont = lines[i]
            if (!cont.trim()) {
              const after = lines[i + 1] ?? ''
              const afterMatch = after.match(/^(\s*)([-*+]|\d{1,9}[.)])\s+/)
              if (afterMatch && afterMatch[1].length <= baseIndent) break
              if (!afterMatch && !/^\s{2,}\S/.test(after)) break
              itemLines.push('')
              i++
              continue
            }
            const indent = cont.match(/^\s*/)?.[0].length ?? 0
            const isItem = /^(\s*)([-*+]|\d{1,9}[.)])\s+/.test(cont)
            if (indent <= baseIndent && isItem) break
            if (indent <= baseIndent && !isItem) break
            itemLines.push(cont.slice(Math.min(indent, baseIndent + 2)))
            i++
          }

          let checked: boolean | null = null
          const first = itemLines[0] ?? ''
          const task = first.match(/^\[([ xX])\]\s+(.*)$/)
          if (task) {
            checked = task[1].toLowerCase() === 'x'
            itemLines[0] = task[2]
          }
          items.push({ checked, blocks: parseNested(itemLines) })
        }

        blocks.push({ kind: 'list', ordered, start, items, tight })
        continue
      }

      // paragraph
      const para: string[] = []
      while (i < end) {
        const cur = lines[i]
        if (!cur.trim()) break
        if (para.length > 0 && startsBlock(lines, i)) break
        para.push(cur)
        i++
      }
      blocks.push({ kind: 'paragraph', inlines: parseInline(para.join('\n').trim()) })
    }

    return blocks
  }

  const parseNested = (nested: string[]): Block[] => {
    // Re-use the same line buffer by temporarily swapping it in.
    const saved = lines.slice()
    const inner = nested.slice()
    lines.length = 0
    for (const l of inner) lines.push(l)
    const result = parseRange(0, lines.length)
    lines.length = 0
    for (const l of saved) lines.push(l)
    return result
  }

  const startsBlock = (buf: string[], idx: number): boolean => {
    const l = buf[idx]
    if (/^ {0,3}(`{3,}|~{3,})/.test(l)) return true
    if (/^ {0,3}#{1,6}\s/.test(l)) return true
    if (/^ {0,3}>/.test(l)) return true
    if (/^(\s*)([-*+]|\d{1,9}[.)])\s+/.test(l)) return true
    if (/^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) return true
    if (l.indexOf('|') >= 0 && isTableDivider(buf[idx + 1] ?? '')) return true
    return false
  }

  return parseRange(0, lines.length)
}

function parseAlign(cell: string): Align {
  const t = cell.trim()
  const left = t.startsWith(':')
  const right = t.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  if (left) return 'left'
  return null
}

function isTableDivider(line: string): boolean {
  const t = line.trim()
  if (!t || t.indexOf('-') < 0) return false
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(t)
}

function splitRow(line: string): string[] {
  let t = line.trim()
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|')) t = t.slice(0, -1)
  const cells: string[] = []
  let cur = ''
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (ch === '\\' && t[i + 1] === '|') {
      cur += '|'
      i++
      continue
    }
    if (ch === '|') {
      cells.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  cells.push(cur.trim())
  return cells
}

export function plainText(inlines: Inline[]): string {
  let s = ''
  for (const n of inlines) {
    switch (n.kind) {
      case 'text':
      case 'code':
        s += n.value
        break
      case 'link':
        s += plainText(n.children)
        break
      case 'image':
        s += n.alt
        break
      case 'br':
        s += ' '
        break
      default:
        s += plainText(n.children)
    }
  }
  return s
}

export function extractOutline(blocks: Block[]): OutlineItem[] {
  const out: OutlineItem[] = []
  const walk = (list: Block[]) => {
    for (const b of list) {
      if (b.kind === 'heading') out.push({ id: b.id, level: b.level, text: b.text })
      else if (b.kind === 'quote') walk(b.blocks)
      else if (b.kind === 'list') b.items.forEach((it) => walk(it.blocks))
    }
  }
  walk(blocks)
  return out
}
