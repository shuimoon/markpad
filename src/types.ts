export type Theme = 'light' | 'sepia' | 'dark'
export type FontChoice = 'sans' | 'serif'
export type MarginSize = 'narrow' | 'normal' | 'wide'
export type EditorMode = 'edit' | 'preview' | 'split'

export interface Doc {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  pinned: boolean
}

export interface Settings {
  theme: Theme
  fontFamily: FontChoice
  fontSize: number
  lineHeight: number
  margin: MarginSize
  highlight: boolean
  mode: EditorMode
}

export interface OutlineItem {
  id: string
  level: number
  text: string
}
