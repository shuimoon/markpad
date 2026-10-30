import type { Doc } from '../types.js'
import { deriveTitle } from './format.js'
import { newId } from './storage.js'

/** One file headed for the library, wherever it came from. */
export interface ImportFile {
  name: string
  path: string
  content: string
}

export interface FolderPick {
  files: ImportFile[]
  truncated: boolean
}

export interface ImportResult {
  added: Doc[]
  addedCount: number
  skipped: number
  truncated: boolean
}

export const IMPORT_EXT = /\.(md|markdown|mdx|mdown|mkd|txt)$/i
export const MAX_IMPORT_FILES = 400
export const MAX_FILE_BYTES = 4 * 1024 * 1024

const GENERIC_TITLES = ['index', 'untitled', '未命名', '无标题', '新建文档', 'draft', 'tmp', 'temp']
const SKIP_DIRS = ['node_modules', '.git', '.svn', '.obsidian', '.trash', '__MACOSX', 'library']

export function isImportableName(name: string): boolean {
  return IMPORT_EXT.test(name)
}

/** `笔记/读书/深度工作.md` → `深度工作` */
export function baseTitle(path: string): string {
  const base = (path || '').split(/[\\/]/).pop() || ''
  const withoutExt = base.replace(IMPORT_EXT, '').trim()
  if (withoutExt && GENERIC_TITLES.indexOf(withoutExt.toLowerCase()) < 0) return withoutExt
  return ''
}

export function normalizeText(text: string): string {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

/**
 * Turn imported files into docs, skipping blanks and anything whose body is
 * already in the library (so importing the same folder twice is a no-op).
 */
export function mergeImportedFiles(existing: Doc[], files: ImportFile[], now = Date.now()): ImportResult {
  const seen = new Set<string>()
  for (const doc of existing) seen.add(doc.content.trim())

  const added: Doc[] = []
  let skipped = 0
  let truncated = false

  for (const file of files) {
    if (added.length >= MAX_IMPORT_FILES) {
      truncated = true
      break
    }
    const content = normalizeText(file.content)
    const key = content.trim()
    if (!key) {
      skipped += 1
      continue
    }
    if (seen.has(key)) {
      skipped += 1
      continue
    }
    seen.add(key)
    const title = baseTitle(file.path || file.name) || deriveTitle(content) || '导入的文档'
    added.push({
      id: newId(),
      title,
      content,
      createdAt: now + added.length,
      updatedAt: now + added.length,
      pinned: false,
    })
  }

  return { added, addedCount: added.length, skipped, truncated }
}

/** Short human summary for the toast after an import. */
export function describeImport(result: ImportResult): string {
  if (result.addedCount === 0) {
    if (result.truncated) return '文件夹太大，只读了前一部分'
    if (result.skipped > 0) return `这 ${result.skipped} 篇已经在库里了`
    return '没有可导入的内容'
  }
  let text = `已导入 ${result.addedCount} 篇`
  if (result.skipped > 0) text += `，跳过 ${result.skipped} 篇`
  if (result.truncated) text += '（数量超上限，只取了前一部分）'
  return text
}

/* ---------- reading from <input type="file"> ---------- */

function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text().catch(() => '')
  }
  return new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => resolve('')
    reader.readAsText(file, 'utf-8')
  })
}

export async function filesFromFileList(list: FileList | null): Promise<ImportFile[]> {
  if (!list || list.length === 0) return []
  const picked: File[] = []
  for (let i = 0; i < list.length; i += 1) {
    const file = list.item(i)
    if (!file) continue
    if (!isImportableName(file.name)) continue
    if (file.size > MAX_FILE_BYTES) continue
    picked.push(file)
    if (picked.length >= MAX_IMPORT_FILES) break
  }
  const out: ImportFile[] = []
  for (const file of picked) {
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath
    out.push({ name: file.name, path: relative && relative.length > 0 ? relative : file.name, content: await readFileText(file) })
  }
  return out
}

/* ---------- walking dropped folders ---------- */

interface FsEntry {
  isFile: boolean
  isDirectory: boolean
  name: string
  file?: (ok: (file: File) => void, fail?: (error: unknown) => void) => void
  createReader?: () => {
    readEntries: (ok: (entries: FsEntry[]) => void, fail?: (error: unknown) => void) => void
  }
}

function readAllEntries(dir: FsEntry): Promise<FsEntry[]> {
  const reader = dir.createReader?.()
  if (!reader) return Promise.resolve([])
  return new Promise((resolve) => {
    const all: FsEntry[] = []
    const step = () => {
      reader.readEntries((batch) => {
        if (!batch || batch.length === 0) {
          resolve(all)
          return
        }
        for (const entry of batch) all.push(entry)
        step()
      }, () => resolve(all))
    }
    step()
  })
}

function readEntryFile(entry: FsEntry): Promise<File | null> {
  const read = entry.file
  if (!read) return Promise.resolve(null)
  return new Promise((resolve) => {
    read(
      (file) => resolve(file),
      () => resolve(null)
    )
  })
}

async function walkEntry(entry: FsEntry, prefix: string, out: ImportFile[]): Promise<void> {
  if (out.length >= MAX_IMPORT_FILES) return
  const path = prefix ? `${prefix}/${entry.name}` : entry.name
  if (entry.isFile) {
    if (!isImportableName(entry.name)) return
    const file = await readEntryFile(entry)
    if (!file || file.size > MAX_FILE_BYTES) return
    out.push({ name: file.name, path, content: await readFileText(file) })
    return
  }
  if (entry.isDirectory) {
    if (SKIP_DIRS.indexOf(entry.name.toLowerCase()) >= 0) return
    const children = await readAllEntries(entry)
    for (const child of children) {
      if (out.length >= MAX_IMPORT_FILES) return
      await walkEntry(child, path, out)
    }
  }
}

export function filesFromEntries(entries: FsEntry[], out: ImportFile[] = []): Promise<ImportFile[]> {
  return entries
    .reduce((chain, entry) => chain.then(() => walkEntry(entry, '', out)), Promise.resolve())
    .then(() => out)
}

export async function filesFromDataTransfer(data: DataTransfer | null): Promise<ImportFile[]> {
  if (!data) return []
  const items = data.items ? Array.from(data.items) : []
  const entries: FsEntry[] = []
  for (const item of items) {
    if (item.kind !== 'file') continue
    const getter = (item as DataTransferItem & { webkitGetAsEntry?: () => FsEntry | null }).webkitGetAsEntry
    if (typeof getter !== 'function') continue
    const entry = getter.call(item)
    if (entry) entries.push(entry)
  }
  if (entries.length > 0) return filesFromEntries(entries)
  return filesFromFileList(data.files)
}

/* ---------- input element helpers ---------- */

function mountInput(attrs: { multiple?: boolean; directory?: boolean }): HTMLInputElement {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.md,.markdown,.mdx,.mdown,.mkd,.txt,text/markdown,text/plain,text/*'
  if (attrs.multiple !== false) input.multiple = true
  if (attrs.directory) {
    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')
  }
  input.style.position = 'fixed'
  input.style.left = '-9999px'
  input.style.opacity = '0'
  document.body.appendChild(input)
  return input
}

/* Android's WebView can fire `focus` before the `change` event that carries the
   picked files, so after the window regains focus poll for a moment instead of
   reading `input.files` once. */
function awaitPickedFiles(input: HTMLInputElement, graceMs: number, done: (files: FileList) => void): void {
  const started = Date.now()
  const timer = window.setInterval(() => {
    const files = input.files
    if (files && files.length > 0) {
      window.clearInterval(timer)
      done(files)
      return
    }
    if (Date.now() - started > graceMs) {
      window.clearInterval(timer)
      done(files ?? new DataTransfer().files)
    }
  }, 120)
}

export function pickFilesElement(): Promise<FileList | null> {
  return new Promise((resolve) => {
    const input = mountInput({ multiple: true })
    let settled = false
    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input)
    }
    const finish = (list: FileList | null) => {
      if (settled) return
      settled = true
      window.setTimeout(cleanup, 0)
      resolve(list && list.length > 0 ? list : null)
    }
    input.addEventListener('change', () => finish(input.files))
    input.addEventListener('cancel', () => finish(null))
    window.addEventListener(
      'focus',
      () => {
        awaitPickedFiles(input, 600, (files) => finish(files))
      },
      { once: true }
    )
    input.click()
  })
}

export function pickFolderElement(): Promise<FileList | null> {
  return new Promise((resolve) => {
    const input = mountInput({ multiple: true, directory: true })
    let settled = false
    const cleanup = () => {
      if (input.parentNode) input.parentNode.removeChild(input)
    }
    const finish = (list: FileList | null) => {
      if (settled) return
      settled = true
      window.setTimeout(cleanup, 0)
      resolve(list && list.length > 0 ? list : null)
    }
    input.addEventListener('change', () => finish(input.files))
    input.addEventListener('cancel', () => finish(null))
    window.addEventListener(
      'focus',
      () => {
        awaitPickedFiles(input, 1200, (files) => finish(files))
      },
      { once: true }
    )
    input.click()
  })
}
