import React, { useMemo, useRef, useState } from 'react'
import type { Doc } from '../types.js'
import { countWords, formatDate, stripMarkdown, wordLabel } from '../lib/format.js'
import { describeImport, filesFromDataTransfer } from '../lib/importers.js'
import { pickMarkdownFiles } from '../lib/platform.js'
import { useStore } from '../store.js'
import { Icon } from '../components/Icon.js'

export function LibraryScreen({
  onOpen,
  onSettings,
}: {
  onOpen: (id: string) => void
  onSettings: () => void
}) {
  const { docs, createDoc, importFiles, toast } = useStore()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dragDepth = useRef(0)

  const trimmed = query.trim()
  const searching = trimmed.length > 0

  const groups = useMemo(() => {
    const list = docs.slice().sort((a, b) => b.updatedAt - a.updatedAt)
    if (searching) {
      const needle = trimmed.toLowerCase()
      const hits = list.filter(
        (doc) => doc.title.toLowerCase().indexOf(needle) >= 0 || doc.content.toLowerCase().indexOf(needle) >= 0
      )
      return { pinned: [] as Doc[], others: hits }
    }
    return {
      pinned: list.filter((doc) => doc.pinned),
      others: list.filter((doc) => !doc.pinned),
    }
  }, [docs, searching, trimmed])

  const total = groups.pinned.length + groups.others.length

  const startNew = () => {
    const doc = createDoc()
    onOpen(doc.id)
  }

  const importFromPicker = () => {
    pickMarkdownFiles().then((files) => {
      if (files.length === 0) return
      toast(describeImport(importFiles(files)))
    })
  }

  const hasFiles = (event: React.DragEvent) => {
    const types = event.dataTransfer ? Array.from(event.dataTransfer.types) : []
    return types.indexOf('Files') >= 0
  }

  const handleDragEnter = (event: React.DragEvent) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepth.current += 1
    setDropActive(true)
  }

  const handleDragOver = (event: React.DragEvent) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDropActive(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepth.current = 0
    setDropActive(false)
    const transfer = event.dataTransfer
    filesFromDataTransfer(transfer).then((files) => {
      if (files.length === 0) {
        toast('没有找到 .md 文件')
        return
      }
      toast(describeImport(importFiles(files)))
    })
  }

  const renderCard = (doc: Doc) => (
    <button key={doc.id} type="button" className="doc-card pressable" onClick={() => onOpen(doc.id)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="doc-title">{highlightText(doc.title || '未命名', trimmed)}</div>
          <div className="doc-excerpt" style={{ marginTop: 5 }}>
            {excerptFor(doc, trimmed)}
          </div>
        </div>
        {doc.pinned ? (
          <span style={{ color: 'var(--accent)', marginTop: 2, flex: 'none' }}>
            <Icon name="pin" size={14} strokeWidth={2.1} />
          </span>
        ) : null}
      </div>
      <div className="doc-meta" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
        <span>{formatDate(doc.updatedAt)}</span>
        <span style={{ opacity: 0.55 }}>·</span>
        <span>{wordLabel(countWords(doc.content))}</span>
      </div>
    </button>
  )

  return (
    <div
      className="screen"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="lib-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h1 className="lib-title">MarkPad</h1>
          <button type="button" className="icon-btn" aria-label="设置" onClick={onSettings}>
            <Icon name="sliders" size={20} />
          </button>
        </div>

        <div className={`search-shell${focused ? ' is-focused' : ''}`} style={{ marginTop: 14 }}>
          <Icon name="search" size={16} strokeWidth={2.1} />
          <input
            ref={inputRef}
            className="search-input"
            value={query}
            placeholder="搜索标题与内容"
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            enterKeyHint="search"
            type="search"
          />
          {query ? (
            <button
              type="button"
              aria-label="清空"
              style={{ display: 'grid', placeItems: 'center', color: 'var(--faint)' }}
              onClick={() => {
                setQuery('')
                if (inputRef.current) inputRef.current.focus()
              }}
            >
              <Icon name="close" size={15} strokeWidth={2.2} />
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="no-scrollbar"
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 16px calc(var(--safe-bottom) + 110px)' }}
      >
        {total === 0 && searching ? (
          <div className="empty-state">
            <div style={{ fontSize: 15, color: 'var(--muted)' }}>没有找到 “{trimmed}”</div>
            <div style={{ marginTop: 6, fontSize: 13 }}>试试别的关键词</div>
          </div>
        ) : null}

        {total === 0 && !searching ? (
          <div className="empty-state">
            <div style={{ fontSize: 15, color: 'var(--muted)' }}>还没有任何文档</div>
            <div style={{ marginTop: 6, fontSize: 13 }}>点右下角的 + 写下第一篇</div>
            <button type="button" className="empty-action" onClick={importFromPicker}>
              <Icon name="upload" size={15} />
              导入 .md 文件
            </button>
          </div>
        ) : null}

        {groups.pinned.length > 0 ? (
          <section style={{ marginBottom: 22 }}>
            <div className="section-label" style={{ padding: '0 4px 9px' }}>
              置顶
            </div>
            <div style={{ display: 'grid', gap: 10 }}>{groups.pinned.map(renderCard)}</div>
          </section>
        ) : null}

        {groups.others.length > 0 ? (
          <section>
            <div
              className="section-label"
              style={{ padding: '0 4px 9px', display: 'flex', justifyContent: 'space-between' }}
            >
              <span>{searching ? `搜索结果 · ${groups.others.length}` : groups.pinned.length > 0 ? '全部文档' : '我的文档'}</span>
              {!searching && docs.length > 0 ? <span style={{ textTransform: 'none', letterSpacing: 0 }}>{docs.length} 篇</span> : null}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>{groups.others.map(renderCard)}</div>
          </section>
        ) : null}
      </div>

      <button type="button" className="fab" aria-label="新建文档" onClick={startNew}>
        <Icon name="plus" size={25} strokeWidth={2.2} />
      </button>

      {dropActive ? (
        <div className="drop-veil">
          <div className="drop-veil-card">
            <Icon name="upload" size={22} strokeWidth={2} />
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8 }}>松手导入</div>
            <div style={{ fontSize: 12.5, marginTop: 4, color: 'var(--muted)' }}>文件或整个文件夹都可以</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text
  const lower = text.toLowerCase()
  const needle = query.toLowerCase()
  const parts: React.ReactNode[] = []
  let cursor = 0
  let index = lower.indexOf(needle)
  while (index >= 0) {
    if (index > cursor) parts.push(text.slice(cursor, index))
    parts.push(
      <mark className="mark" key={`m-${index}`}>
        {text.slice(index, index + needle.length)}
      </mark>
    )
    cursor = index + needle.length
    index = lower.indexOf(needle, cursor)
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

function excerptFor(doc: Doc, query: string): React.ReactNode {
  const plain = stripMarkdown(doc.content, 4000)
  if (!plain) return '空白文档'
  if (!query) return plain.slice(0, 110) + (plain.length > 110 ? '…' : '')

  const lower = plain.toLowerCase()
  const index = lower.indexOf(query.toLowerCase())
  if (index < 0) return plain.slice(0, 110) + (plain.length > 110 ? '…' : '')
  const start = Math.max(0, index - 34)
  const end = Math.min(plain.length, index + query.length + 78)
  const slice = plain.slice(start, end)
  return (
    <>
      {start > 0 ? '…' : ''}
      {highlightText(slice, query)}
      {end < plain.length ? '…' : ''}
    </>
  )
}
