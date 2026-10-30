import type { Doc, Settings } from '../types.js'

const DOCS_KEY = 'markpad.docs.v1'
const SETTINGS_KEY = 'markpad.settings.v1'
const SEED_KEY = 'markpad.seeded.v1'

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota exceeded — keep the app usable */
  }
}

export function loadDocs(): Doc[] | null {
  const docs = readJson<Doc[]>(DOCS_KEY)
  if (!Array.isArray(docs)) return null
  return docs
    .filter((d) => d && typeof d.id === 'string')
    .map((d) => ({
      id: d.id,
      title: typeof d.title === 'string' ? d.title : '',
      content: typeof d.content === 'string' ? d.content : '',
      createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
      updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now(),
      pinned: Boolean(d.pinned),
    }))
}

export function saveDocs(docs: Doc[]): void {
  writeJson(DOCS_KEY, docs)
}

export function loadSettings(): Partial<Settings> | null {
  return readJson<Partial<Settings>>(SETTINGS_KEY)
}

export function saveSettings(settings: Settings): void {
  writeJson(SETTINGS_KEY, settings)
}

export function hasSeeded(): boolean {
  try {
    return localStorage.getItem(SEED_KEY) === '1'
  } catch {
    return true
  }
}

export function markSeeded(): void {
  try {
    localStorage.setItem(SEED_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function newId(): string {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 7)
  return `${t}${r}`
}
