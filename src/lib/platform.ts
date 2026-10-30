import type { FolderPick, ImportFile } from './importers.js'
import { filesFromFileList, normalizeText, pickFilesElement, pickFolderElement } from './importers.js'

export interface NativeBridge {
  saveFile(name: string, content: string): string
  shareFile(name: string, content: string): void
  setBars?(dark: string, color: string): void
  haptic?(): void
  /** Opens the folder picker; the result arrives via window.__markpadFolder. */
  pickFolder?(): void
}

declare global {
  interface Window {
    MarkPad?: NativeBridge
    __markpadBack?: () => boolean
    __markpadFolder?: (payload: unknown) => void
  }
}

export function bridge(): NativeBridge | null {
  if (typeof window === 'undefined') return null
  return window.MarkPad ?? null
}

export function isNative(): boolean {
  return bridge() !== null
}

export function safeFileName(title: string): string {
  const base = (title || '').trim().replace(/[\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ')
  const trimmed = base.slice(0, 60).trim() || '未命名'
  return trimmed.toLowerCase().endsWith('.md') ? trimmed : `${trimmed}.md`
}

function downloadBlob(name: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Export a markdown file. Returns a short status message for the toast. */
export function exportFile(title: string, content: string): string {
  const name = safeFileName(title)
  const b = bridge()
  if (b) {
    try {
      const path = b.saveFile(name, content)
      return path ? `已保存到 ${path}` : '已保存到下载目录'
    } catch {
      return '保存失败'
    }
  }
  downloadBlob(name, content)
  return '已下载 ' + name
}

export async function shareFile(title: string, content: string): Promise<string> {
  const name = safeFileName(title)
  const b = bridge()
  if (b) {
    try {
      b.shareFile(name, content)
      return '正在分享'
    } catch {
      return '分享失败'
    }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text: content })
      return '已分享'
    } catch {
      return '已取消分享'
    }
  }
  downloadBlob(name, content)
  return '已下载 ' + name
}

export function haptic(): void {
  const b = bridge()
  if (b && b.haptic) {
    try {
      b.haptic()
      return
    } catch {
      /* ignore */
    }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(8)
  }
}

/** Pick one or more .md/.txt files. */
export function pickMarkdownFiles(): Promise<ImportFile[]> {
  return pickFilesElement().then((list) => filesFromFileList(list))
}

/**
 * Pick a folder. On Android the WebView cannot open a directory picker, so the
 * native SAF bridge does the walking and calls back into `window.__markpadFolder`.
 */
export function pickMarkdownFolder(): Promise<FolderPick> {
  const native = bridge()
  if (native && typeof native.pickFolder === 'function') return pickFolderNative()
  return pickFolderElement().then((list) =>
    filesFromFileList(list).then((files) => ({ files, truncated: false }))
  )
}

function parseFolderPayload(payload: unknown): FolderPick {
  let data: unknown = payload
  if (typeof payload === 'string') {
    try {
      data = JSON.parse(payload)
    } catch {
      data = null
    }
  }
  const source = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { files?: unknown }).files)
      ? ((data as { files: unknown[] }).files)
      : []
  const files: ImportFile[] = []
  for (const item of source) {
    if (!item || typeof item !== 'object') continue
    const record = item as { name?: unknown; path?: unknown; content?: unknown }
    if (typeof record.content !== 'string') continue
    const name = String(record.name ?? record.path ?? '')
    if (!name) continue
    files.push({
      name,
      path: String(record.path ?? name),
      content: normalizeText(record.content),
    })
  }
  const truncated = Boolean(data && typeof data === 'object' && (data as { truncated?: unknown }).truncated)
  return { files, truncated }
}

function pickFolderNative(): Promise<FolderPick> {
  return new Promise((resolve) => {
    const previous = window.__markpadFolder
    let settled = false
    const timer = window.setTimeout(() => finish({ files: [], truncated: false }), 5 * 60 * 1000)

    function finish(result: FolderPick) {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      window.__markpadFolder = previous
      resolve(result)
    }

    window.__markpadFolder = (payload: unknown) => finish(parseFolderPayload(payload))
    try {
      bridge()?.pickFolder?.()
    } catch {
      finish({ files: [], truncated: false })
    }
  })
}

export function pickImageFile(): Promise<{ name: string; dataUrl: string; size: number } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    document.body.appendChild(input)

    let settled = false
    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input)
    }
    const finish = (file: File | null | undefined) => {
      if (settled) return
      settled = true
      if (!file) {
        cleanup()
        resolve(null)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        cleanup()
        resolve({ name: file.name.replace(/\.[a-z0-9]+$/i, ''), dataUrl: String(reader.result ?? ''), size: file.size })
      }
      reader.onerror = () => {
        cleanup()
        resolve(null)
      }
      reader.readAsDataURL(file)
    }

    input.addEventListener('change', () => finish(input.files && input.files[0]))
    window.addEventListener(
      'focus',
      () => {
        setTimeout(() => finish(input.files && input.files[0]), 700)
      },
      { once: true }
    )
    input.click()
  })
}

export function syncSystemBars(dark: boolean, color: string): void {
  const meta = document.getElementById('meta-theme-color')
  if (meta) meta.setAttribute('content', color)
  const b = bridge()
  if (b && b.setBars) {
    try {
      b.setBars(dark ? '1' : '0', color)
    } catch {
      /* ignore */
    }
  }
}

export function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => fallbackCopy(text)
    )
  }
  return Promise.resolve(fallbackCopy(text))
}

function fallbackCopy(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(area)
  return ok
}
