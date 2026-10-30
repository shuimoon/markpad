import React, { useMemo, useState } from 'react'
import type { Block, Inline, ListItem } from '../lib/markdown.js'
import { tokenizeCode } from '../lib/code.js'
import { copyText } from '../lib/platform.js'
import { Icon } from './Icon.js'

interface Ctx {
  counter: { n: number }
  onToggleTask?: (ordinal: number) => void
}

export function MarkdownView({
  blocks,
  onToggleTask,
  className,
}: {
  blocks: Block[]
  onToggleTask?: (ordinal: number) => void
  className?: string
}) {
  const ctx: Ctx = { counter: { n: 0 }, onToggleTask }
  return <div className={`md-body ${className ?? ''}`}>{renderBlocks(blocks, ctx, 'b')}</div>
}

function renderBlocks(blocks: Block[], ctx: Ctx, keyBase: string): React.ReactNode[] {
  return blocks.map((block, index) => renderBlock(block, ctx, `${keyBase}-${index}`))
}

function renderBlock(block: Block, ctx: Ctx, key: string): React.ReactNode {
  switch (block.kind) {
    case 'heading': {
      const Tag = (`h${Math.min(6, Math.max(1, block.level))}` as unknown) as 'h1'
      return (
        <Tag key={key} id={block.id}>
          {renderInline(block.inlines, key)}
        </Tag>
      )
    }
    case 'paragraph':
      return <p key={key}>{renderInline(block.inlines, key)}</p>
    case 'code':
      return <CodeBlock key={key} code={block.code} lang={block.lang} />
    case 'quote':
      return <blockquote key={key}>{renderBlocks(block.blocks, ctx, key)}</blockquote>
    case 'list':
      return renderList(block, ctx, key)
    case 'hr':
      return <hr key={key} />
    case 'table':
      return (
        <table key={key}>
          <thead>
            <tr>
              {block.head.map((cell, i) => (
                <th key={i} style={{ textAlign: block.aligns[i] ?? undefined }}>
                  {renderInline(cell, `${key}-h-${i}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} style={{ textAlign: block.aligns[c] ?? undefined }}>
                    {renderInline(cell, `${key}-${r}-${c}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
    default:
      return null
  }
}

function renderList(block: Extract<Block, { kind: 'list' }>, ctx: Ctx, key: string): React.ReactNode {
  const ordered = block.ordered
  const items = block.items.map((item, index) => renderListItem(item, block.tight, ctx, `${key}-${index}`))
  if (ordered) {
    return (
      <ol key={key} start={block.start !== 1 ? block.start : undefined}>
        {items}
      </ol>
    )
  }
  return <ul key={key}>{items}</ul>
}

function renderListItem(item: ListItem, tight: boolean, ctx: Ctx, key: string): React.ReactNode {
  const isTask = item.checked !== null
  const ordinal = isTask ? ctx.counter.n++ : -1

  const content = item.blocks.map((block, index) => {
    if (block.kind === 'paragraph' && tight) {
      return <React.Fragment key={index}>{renderInline(block.inlines, `${key}-p-${index}`)}</React.Fragment>
    }
    return renderBlock(block, ctx, `${key}-b-${index}`)
  })

  if (isTask) {
    const done = Boolean(item.checked)
    return (
      <li key={key} className={`task-item${done ? ' is-done' : ''}`}>
        <button
          type="button"
          className={`task-box${done ? ' is-done' : ''}`}
          aria-pressed={done}
          aria-label={done ? '标记为未完成' : '标记为已完成'}
          onClick={() => ctx.onToggleTask && ctx.onToggleTask(ordinal)}
        >
          {done ? <Icon name="check" size={11} strokeWidth={3.4} /> : null}
        </button>
        <span className="task-text">{content}</span>
      </li>
    )
  }

  return <li key={key}>{content}</li>
}

function renderInline(inlines: Inline[], keyBase: string): React.ReactNode[] {
  return inlines.map((node, index) => {
    const key = `${keyBase}-${index}`
    switch (node.kind) {
      case 'text':
        return <React.Fragment key={key}>{node.value}</React.Fragment>
      case 'strong':
        return <strong key={key}>{renderInline(node.children, key)}</strong>
      case 'em':
        return <em key={key}>{renderInline(node.children, key)}</em>
      case 'del':
        return <del key={key}>{renderInline(node.children, key)}</del>
      case 'code':
        return <code key={key}>{node.value}</code>
      case 'link':
        return (
          <a key={key} href={node.href} target="_blank" rel="noreferrer noopener">
            {renderInline(node.children, key)}
          </a>
        )
      case 'image':
        return <img key={key} src={node.src} alt={node.alt} loading="lazy" />
      case 'br':
        return <br key={key} />
      default:
        return null
    }
  })
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false)
  const tokens = useMemo(() => tokenizeCode(code, lang), [code, lang])

  const copy = () => {
    copyText(code).then((ok) => {
      if (!ok) return
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    })
  }

  return (
    <pre>
      <div className="code-head">
        <span>{lang || 'code'}</span>
        <button
          type="button"
          onClick={copy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            letterSpacing: '0.02em',
            textTransform: 'none',
            color: copied ? '#8ce0c2' : '#9aa3b2',
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} size={12} strokeWidth={2.2} />
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <code>
        {tokens.map((token, index) =>
          token.cls ? (
            <span key={index} className={token.cls}>
              {token.text}
            </span>
          ) : (
            <React.Fragment key={index}>{token.text}</React.Fragment>
          )
        )}
      </code>
    </pre>
  )
}
