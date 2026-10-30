import React, { useCallback, useMemo, useRef, useState } from 'react'
import type { EditorMode } from '../types.js'
import { countWords, deriveTitle, readingMinutes, wordLabel } from '../lib/format.js'
import { extractOutline, parseBlocks } from '../lib/markdown.js'
import { exportFile, pickImageFile, shareFile } from '../lib/platform.js'
import { useStore } from '../store.js'
import { Icon } from '../components/Icon.js'
import { MarkdownView } from '../components/MarkdownView.js'
import { BlockFormat, EditorApi, MarkdownEditor } from '../components/Editor.js'
import { ConfirmSheet, Sheet, SheetRow } from '../components/Sheet.js'

const MODES: { key: EditorMode; label: string }[] = [
  { key: 'edit', label: '编辑' },
  { key: 'split', label: '分屏' },
  { key: 'preview', label: '预览' },
]

export function EditorScreen({
  docId,
  onBack,
  onOpenSettings,
}: {
  docId: string
  onBack: () => void
  onOpenSettings: () => void
}) {
  const { docs, settings, updateDoc, updateSettings, deleteDoc, duplicateDoc, togglePin, toast } = useStore()
  const doc = docs.find((d) => d.id === docId)

  const [menuOpen, setMenuOpen] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [ratio, setRatio] = useState(0.52)

  const editorRef = useRef<EditorApi | null>(null)
  const splitRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef(false)

  const mode = settings.mode

  const content = doc ? doc.content : ''
  const blocks = useMemo(() => parseBlocks(content), [content])
  const outline = useMemo(() => extractOutline(blocks), [blocks])
  const words = useMemo(() => countWords(content), [content])

  const setMode = (next: EditorMode) => updateSettings({ mode: next })

  const toggleTask = useCallback(
    (ordinal: number) => {
      if (!doc) return
      updateDoc(doc.id, { content: toggleTaskInSource(doc.content, ordinal) })
    },
    [doc, updateDoc]
  )

  const onDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !splitRef.current) return
    const rect = splitRef.current.getBoundingClientRect()
    if (rect.height <= 0) return
    const next = (event.clientY - rect.top) / rect.height
    setRatio(Math.min(0.78, Math.max(0.24, next)))
  }

  const onDragEnd = () => {
    dragRef.current = false
  }

  if (!doc) {
    return (
      <div className="screen">
        <div className="empty-state">这篇文档已经不在了</div>
        <div style={{ textAlign: 'center' }}>
          <button type="button" className="tool-key" onClick={onBack}>
            返回
          </button>
        </div>
      </div>
    )
  }

  const insertTable = () => {
    editorRef.current?.replaceSelection('\n| 列一 | 列二 |\n| --- | --- |\n| 内容 | 内容 |\n')
  }

  const insertDivider = () => {
    editorRef.current?.replaceSelection('\n---\n')
  }

  const insertLink = () => {
    editorRef.current?.wrap('[', '](https://)', '链接文字')
  }

  const insertImage = () => {
    pickImageFile().then((file) => {
      if (!file) return
      if (file.size > 2_400_000) {
        toast('图片太大（超过 2MB），换一张小一点的')
        return
      }
      editorRef.current?.replaceSelection(`![${file.name || '图片'}](${file.dataUrl})`)
      toast('图片已插入')
    })
  }

  const doExport = () => {
    const message = exportFile(doc.title, doc.content)
    toast(message)
    setMenuOpen(false)
  }

  const doShare = () => {
    setMenuOpen(false)
    shareFile(doc.title, doc.content).then((message) => toast(message))
  }

  const jumpTo = (id: string) => {
    setOutlineOpen(false)
    if (mode === 'edit') {
      setMode('preview')
      window.setTimeout(() => scrollToHeading(id), 60)
      return
    }
    scrollToHeading(id)
  }

  const toolbar: { key: string; label: React.ReactNode; run: () => void }[] = [
    { key: 'bold', label: 'B', run: () => editorRef.current?.wrap('**', '**', '加粗') },
    { key: 'italic', label: 'I', run: () => editorRef.current?.wrap('*', '*', '斜体') },
    { key: 'strike', label: 'S', run: () => editorRef.current?.wrap('~~', '~~', '删除线') },
    { key: 'h', label: <Icon name="type" size={17} />, run: () => format('h2') },
    { key: 'quote', label: '❝', run: () => format('quote') },
    { key: 'bullet', label: '•', run: () => format('bullet') },
    { key: 'ordered', label: '1.', run: () => format('ordered') },
    { key: 'task', label: '☑', run: () => format('task') },
    { key: 'code', label: <Icon name="code" size={17} />, run: () => editorRef.current?.wrap('`', '`', '代码') },
    { key: 'link', label: <Icon name="link" size={17} />, run: insertLink },
    { key: 'image', label: <Icon name="image" size={17} />, run: insertImage },
    { key: 'divider', label: '—', run: insertDivider },
    { key: 'table', label: '▦', run: insertTable },
  ]

  function format(kind: BlockFormat) {
    editorRef.current?.formatLines(kind)
  }

  const editorPane = (
    <MarkdownEditor
      ref={editorRef}
      value={doc.content}
      onChange={(next) => updateDoc(doc.id, { content: next })}
      highlight={settings.highlight}
      placeholder="从这里开始写……"
    />
  )

  const previewPane = (
    <div className="reader no-scrollbar">
      <MarkdownView blocks={blocks} onToggleTask={toggleTask} />
    </div>
  )

  return (
    <div className="screen">
      <div className="editor-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button type="button" className="icon-btn" aria-label="返回" onClick={onBack}>
            <Icon name="back" size={22} />
          </button>
          <input
            value={doc.title}
            onChange={(event) => updateDoc(doc.id, { title: event.target.value })}
            onBlur={() => {
              if (!doc.title.trim()) updateDoc(doc.id, { title: deriveTitle(doc.content) || '未命名' })
            }}
            placeholder="未命名"
            aria-label="标题"
            style={{
              flex: 1,
              minWidth: 0,
              border: 0,
              outline: 0,
              background: 'transparent',
              fontSize: 16.5,
              fontWeight: 620,
              letterSpacing: '-0.01em',
              padding: '6px 2px',
            }}
          />
          <button type="button" className="icon-btn" aria-label="更多" onClick={() => setMenuOpen(true)}>
            <Icon name="more" size={20} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginTop: 6,
          }}
        >
          <div className="segmented">
            {MODES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`segmented-item${mode === item.key ? ' is-active' : ''}`}
                onClick={() => setMode(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="editor-status" style={{ padding: 0 }}>
            <span>{wordLabel(words)}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>{readingMinutes(content)} 分钟</span>
          </div>
        </div>
      </div>

      {mode === 'edit' ? <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>{editorPane}</div> : null}

      {mode === 'preview' ? previewPane : null}

      {mode === 'split' ? (
        <div className="split-wrap" ref={splitRef}>
          <div
            className="split-pane"
            style={{ flex: `${ratio} 1 0`, display: 'flex', flexDirection: 'column' }}
          >
            {editorPane}
          </div>
          <div
            className="split-handle"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            <div className="split-grip" />
          </div>
          <div
            className="split-pane"
            style={{
              flex: `${1 - ratio} 1 0`,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--surface)',
            }}
          >
            {previewPane}
          </div>
        </div>
      ) : null}

      {mode !== 'preview' ? (
        <div className="toolbar no-scrollbar">
          {toolbar.map((item) => (
            <button
              key={item.key}
              type="button"
              className="tool-key"
              onMouseDown={(event) => event.preventDefault()}
              onClick={item.run}
              aria-label={item.key}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={doc.title || '未命名'}>
        <SheetRow
          icon="outline"
          label="大纲"
          trailing={<span style={{ color: 'var(--faint)', fontSize: 12.5 }}>{outline.length}</span>}
          onClick={() => {
            setMenuOpen(false)
            if (outline.length === 0) {
              toast('这篇还没有标题')
              return
            }
            setOutlineOpen(true)
          }}
        />
        <SheetRow
          icon="pin"
          label={doc.pinned ? '取消置顶' : '置顶'}
          onClick={() => {
            togglePin(doc.id)
            setMenuOpen(false)
          }}
        />
        <SheetRow icon="share" label="分享" onClick={doShare} />
        <SheetRow icon="download" label="导出 .md" onClick={doExport} />
        <SheetRow
          icon="copy"
          label="复制一份"
          onClick={() => {
            const copy = duplicateDoc(doc.id)
            setMenuOpen(false)
            if (copy) toast('已复制')
          }}
        />
        <SheetRow
          icon="sliders"
          label="阅读设置"
          onClick={() => {
            setMenuOpen(false)
            onOpenSettings()
          }}
        />
        <SheetRow
          icon="trash"
          label="删除"
          danger
          onClick={() => {
            setMenuOpen(false)
            setConfirmOpen(true)
          }}
        />
      </Sheet>

      <Sheet open={outlineOpen} onClose={() => setOutlineOpen(false)} title="大纲">
        <div style={{ maxHeight: '56vh', overflowY: 'auto' }} className="no-scrollbar">
          {outline.map((item) => (
            <button
              key={item.id}
              type="button"
              className="sheet-row"
              style={{ paddingLeft: 12 + (item.level - 1) * 14 }}
              onClick={() => jumpTo(item.id)}
            >
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: item.level === 1 ? 600 : 450,
                  fontSize: item.level === 1 ? 15 : 14,
                }}
              >
                {item.text}
              </span>
            </button>
          ))}
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmOpen}
        title="删除这篇文档？"
        message="删除后无法恢复，建议先导出备份。"
        confirmLabel="删除"
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          deleteDoc(doc.id)
          toast('已删除')
          onBack()
        }}
      />
    </div>
  )
}

function scrollToHeading(id: string) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const TASK_LINE = /^(\s*(?:>\s*)*)([-*+])\s+\[([ xX])\]\s/

export function toggleTaskInSource(source: string, ordinal: number): string {
  const lines = source.split('\n')
  let seen = -1
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(TASK_LINE)
    if (!match) continue
    seen += 1
    if (seen !== ordinal) continue
    const done = match[3].toLowerCase() === 'x'
    lines[i] = lines[i].replace(/\[([ xX])\]/, done ? '[ ]' : '[x]')
    return lines.join('\n')
  }
  return source
}
