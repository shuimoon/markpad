import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Doc, Settings } from './types.js'
import {
  hasSeeded,
  loadDocs,
  loadSettings,
  markSeeded,
  newId,
  saveDocs,
  saveSettings,
} from './lib/storage.js'
import { buildSamples } from './lib/samples.js'
import { deriveTitle } from './lib/format.js'
import { mergeImportedFiles } from './lib/importers.js'
import type { ImportFile, ImportResult } from './lib/importers.js'
import { syncSystemBars } from './lib/platform.js'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  fontFamily: 'sans',
  fontSize: 16,
  lineHeight: 1.75,
  margin: 'normal',
  highlight: true,
  mode: 'split',
}

const CANVAS: Record<string, string> = {
  light: '#f4f3ef',
  sepia: '#f2e8d8',
  dark: '#0e0f11',
}

const SERIF = '"Songti SC", "Noto Serif SC", Georgia, "Times New Roman", serif'

const MARGIN: Record<string, string> = { narrow: '14px', normal: '20px', wide: '30px' }

interface StoreValue {
  docs: Doc[]
  settings: Settings
  toastText: string | null
  toast(text: string): void
  createDoc(content?: string, title?: string): Doc
  updateDoc(id: string, patch: Partial<Doc>): void
  deleteDoc(id: string): void
  duplicateDoc(id: string): Doc | null
  togglePin(id: string): void
  importFiles(files: ImportFile[]): ImportResult
  updateSettings(patch: Partial<Settings>): void
  getDoc(id: string): Doc | undefined
}

const StoreContext = createContext<StoreValue | null>(null)

function bootstrapDocs(): Doc[] {
  const stored = loadDocs()
  if (stored && stored.length > 0) return stored
  if (stored && stored.length === 0 && hasSeeded()) return []
  const samples = buildSamples(Date.now())
  markSeeded()
  return samples
}

function bootstrapSettings(): Settings {
  const stored = loadSettings()
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [docs, setDocs] = useState<Doc[]>(bootstrapDocs)
  const [settings, setSettings] = useState<Settings>(bootstrapSettings)
  const [toastText, setToastText] = useState<string | null>(null)

  const toastTimer = useRef<number | null>(null)
  const saveTimer = useRef<number | null>(null)

  const toast = useCallback((text: string) => {
    setToastText(text)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastText(null), 1900)
  }, [])

  useEffect(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => saveDocs(docs), 240)
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
    }
  }, [docs])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', settings.theme)
    root.style.setProperty('--read-font-size', `${settings.fontSize}px`)
    root.style.setProperty('--read-line-height', String(settings.lineHeight))
    root.style.setProperty('--read-margin', MARGIN[settings.margin] ?? '20px')
    root.style.setProperty(
      '--read-font-family',
      settings.fontFamily === 'serif'
        ? SERIF
        : '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif'
    )
    const canvas = CANVAS[settings.theme] ?? CANVAS.light
    root.style.backgroundColor = canvas
    document.body.style.backgroundColor = canvas
    syncSystemBars(settings.theme === 'dark', canvas)
  }, [settings])

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
    }
  }, [])

  const createDoc = useCallback((content = '', title = '') => {
    const now = Date.now()
    const doc: Doc = {
      id: newId(),
      title: title || deriveTitle(content) || '未命名',
      content,
      createdAt: now,
      updatedAt: now,
      pinned: false,
    }
    setDocs((prev) => [doc, ...prev])
    return doc
  }, [])

  const updateDoc = useCallback((id: string, patch: Partial<Doc>) => {
    const now = Date.now()
    setDocs((prev) =>
      prev.map((doc) => {
        if (doc.id !== id) return doc
        const next: Doc = { ...doc, ...patch, updatedAt: now }
        if (patch.content !== undefined && (doc.title === '' || doc.title === '未命名')) {
          const derived = deriveTitle(patch.content)
          if (derived) next.title = derived
        }
        return next
      })
    )
  }, [])

  const deleteDoc = useCallback((id: string) => {
    setDocs((prev) => prev.filter((doc) => doc.id !== id))
  }, [])

  const duplicateDoc = useCallback((id: string) => {
    let copy: Doc | null = null
    setDocs((prev) => {
      const source = prev.find((doc) => doc.id === id)
      if (!source) return prev
      const now = Date.now()
      copy = { ...source, id: newId(), title: `${source.title} 副本`, pinned: false, createdAt: now, updatedAt: now }
      return [copy, ...prev]
    })
    return copy
  }, [])

  const togglePin = useCallback((id: string) => {
    setDocs((prev) => prev.map((doc) => (doc.id === id ? { ...doc, pinned: !doc.pinned } : doc)))
  }, [])

  const importFiles = useCallback(
    (files: ImportFile[]) => {
      const result = mergeImportedFiles(docs, files)
      if (result.addedCount > 0) setDocs((prev) => [...result.added, ...prev])
      return result
    },
    [docs]
  )

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const getDoc = useCallback((id: string) => docs.find((doc) => doc.id === id), [docs])

  const value = useMemo<StoreValue>(
    () => ({
      docs,
      settings,
      toastText,
      toast,
      createDoc,
      updateDoc,
      deleteDoc,
      duplicateDoc,
      togglePin,
      importFiles,
      updateSettings,
      getDoc,
    }),
    [
      docs,
      settings,
      toastText,
      toast,
      createDoc,
      updateDoc,
      deleteDoc,
      duplicateDoc,
      togglePin,
      importFiles,
      updateSettings,
      getDoc,
    ]
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
