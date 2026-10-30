import React from 'react'
import type { FontChoice, MarginSize, Theme } from '../types.js'
import { describeImport } from '../lib/importers.js'
import { exportFile, isNative, pickMarkdownFiles, pickMarkdownFolder } from '../lib/platform.js'
import { useStore } from '../store.js'
import { Icon } from '../components/Icon.js'

const THEMES: { key: Theme; label: string }[] = [
  { key: 'light', label: '浅色' },
  { key: 'sepia', label: '护眼' },
  { key: 'dark', label: '深色' },
]

const FONTS: { key: FontChoice; label: string }[] = [
  { key: 'sans', label: '无衬线' },
  { key: 'serif', label: '衬线' },
]

const MARGINS: { key: MarginSize; label: string }[] = [
  { key: 'narrow', label: '窄' },
  { key: 'normal', label: '标准' },
  { key: 'wide', label: '宽' },
]

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { settings, updateSettings, docs, importFiles, toast } = useStore()

  const importNow = () => {
    pickMarkdownFiles().then((files) => {
      if (files.length === 0) return
      toast(describeImport(importFiles(files)))
    })
  }

  const importFolderNow = () => {
    toast('正在读取文件夹…')
    pickMarkdownFolder().then((picked) => {
      if (picked.files.length === 0) {
        toast(picked.truncated ? '文件夹太深了，换一个试试' : '这个文件夹里没有 .md 文件')
        return
      }
      const result = importFiles(picked.files)
      toast(describeImport({ ...result, truncated: result.truncated || picked.truncated }))
    })
  }

  const exportAll = () => {
    if (docs.length === 0) {
      toast('还没有可导出的文档')
      return
    }
    const sorted = docs.slice().sort((a, b) => a.createdAt - b.createdAt)
    const body = sorted
      .map((doc) => `# ${doc.title || '未命名'}\n\n${doc.content.trim()}\n`)
      .join('\n\n---\n\n')
    const message = exportFile('MarkPad 备份', `<!-- MarkPad 备份 · ${new Date().toLocaleString()} -->\n\n${body}`)
    toast(message)
  }

  return (
    <div className="screen">
      <div className="editor-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button type="button" className="icon-btn" aria-label="返回" onClick={onBack}>
            <Icon name="back" size={22} />
          </button>
          <div style={{ flex: 1, fontSize: 16.5, fontWeight: 620, letterSpacing: '-0.01em', padding: '6px 2px' }}>
            设置
          </div>
        </div>
      </div>

      <div
        className="no-scrollbar"
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 16px calc(var(--safe-bottom) + 36px)' }}
      >
        <div className="section-label" style={{ padding: '6px 4px 9px' }}>
          外观
        </div>
        <div className="setting-card" style={{ marginBottom: 22 }}>
          <div className="setting-row">
            <span style={{ fontSize: 14.5 }}>主题</span>
            <div className="choice-group">
              {THEMES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`choice${settings.theme === item.key ? ' is-active' : ''}`}
                  onClick={() => updateSettings({ theme: item.key })}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-row">
            <span style={{ fontSize: 14.5 }}>正文字体</span>
            <div className="choice-group">
              {FONTS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`choice${settings.fontFamily === item.key ? ' is-active' : ''}`}
                  onClick={() => updateSettings({ fontFamily: item.key })}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-row">
            <span style={{ fontSize: 14.5 }}>字号</span>
            <div className="stepper">
              <button
                type="button"
                className="stepper-btn"
                aria-label="减小字号"
                disabled={settings.fontSize <= 13}
                onClick={() => updateSettings({ fontSize: Math.max(13, settings.fontSize - 1) })}
              >
                −
              </button>
              <span className="stepper-value">{settings.fontSize}px</span>
              <button
                type="button"
                className="stepper-btn"
                aria-label="增大字号"
                disabled={settings.fontSize >= 22}
                onClick={() => updateSettings({ fontSize: Math.min(22, settings.fontSize + 1) })}
              >
                +
              </button>
            </div>
          </div>

          <div className="setting-row">
            <span style={{ fontSize: 14.5 }}>行高</span>
            <div className="stepper">
              <button
                type="button"
                className="stepper-btn"
                aria-label="减小行高"
                disabled={settings.lineHeight <= 1.5}
                onClick={() => updateSettings({ lineHeight: Math.round((settings.lineHeight - 0.05) * 100) / 100 })}
              >
                −
              </button>
              <span className="stepper-value">{settings.lineHeight.toFixed(2)}</span>
              <button
                type="button"
                className="stepper-btn"
                aria-label="增大行高"
                disabled={settings.lineHeight >= 2.2}
                onClick={() => updateSettings({ lineHeight: Math.round((settings.lineHeight + 0.05) * 100) / 100 })}
              >
                +
              </button>
            </div>
          </div>

          <div className="setting-row">
            <span style={{ fontSize: 14.5 }}>页边距</span>
            <div className="choice-group">
              {MARGINS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`choice${settings.margin === item.key ? ' is-active' : ''}`}
                  onClick={() => updateSettings({ margin: item.key })}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="section-label" style={{ padding: '6px 4px 9px' }}>
          编辑
        </div>
        <div className="setting-card" style={{ marginBottom: 22 }}>
          <div className="setting-row">
            <div>
              <div style={{ fontSize: 14.5 }}>语法高亮</div>
              <div style={{ marginTop: 3, fontSize: 12, color: 'var(--faint)' }}>编辑时给标记上色</div>
            </div>
            <button
              type="button"
              className={`switch${settings.highlight ? ' is-on' : ''}`}
              role="switch"
              aria-checked={settings.highlight}
              onClick={() => updateSettings({ highlight: !settings.highlight })}
            >
              <span className="switch-knob" />
            </button>
          </div>
        </div>

        <div className="section-label" style={{ padding: '6px 4px 9px' }}>
          数据
        </div>
        <div className="setting-card" style={{ marginBottom: 22 }}>
          <button type="button" className="setting-row" style={{ width: '100%' }} onClick={importNow}>
            <span style={{ fontSize: 14.5 }}>导入文件（.md / .txt）</span>
            <Icon name="upload" size={18} />
          </button>
          <button type="button" className="setting-row" style={{ width: '100%' }} onClick={importFolderNow}>
            <span style={{ fontSize: 14.5 }}>导入文件夹</span>
            <Icon name="folder" size={18} />
          </button>
          <button type="button" className="setting-row" style={{ width: '100%' }} onClick={exportAll}>
            <span style={{ fontSize: 14.5 }}>导出全部（.md）</span>
            <Icon name="download" size={18} />
          </button>
        </div>

        <div className="setting-card">
          <div className="setting-row">
            <span style={{ fontSize: 14.5 }}>文档数量</span>
            <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>{docs.length} 篇</span>
          </div>
          <div className="setting-row">
            <span style={{ fontSize: 14.5 }}>存储方式</span>
            <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>
              {isNative() ? '设备本地' : '浏览器本地'}
            </span>
          </div>
          <div className="setting-row">
            <span style={{ fontSize: 14.5 }}>版本</span>
            <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>1.1.0</span>
          </div>
        </div>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--faint)', lineHeight: 1.7 }}>
          MarkPad · 纯本地 Markdown 写作
          <br />
          所有内容只存在这台设备上
        </div>
      </div>
    </div>
  )
}
