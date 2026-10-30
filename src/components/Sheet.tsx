import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon, IconName } from './Icon.js'

const closeStack: Array<() => void> = []

/** Used by the Android back button: closes the top-most sheet, returns true if it did. */
export function closeTopSheet(): boolean {
  const top = closeStack[closeStack.length - 1]
  if (!top) return false
  top()
  return true
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    closeStack.push(onClose)
    return () => {
      window.removeEventListener('keydown', onKey)
      const index = closeStack.lastIndexOf(onClose)
      if (index >= 0) closeStack.splice(index, 1)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      <div className="scrim" onPointerDown={onClose} />
      <div className="sheet-panel animate-sheet-up" role="dialog" aria-modal="true">
        <div className="sheet-grabber" />
        {title ? (
          <div
            className="section-label"
            style={{ padding: '4px 12px 8px' }}
          >
            {title}
          </div>
        ) : null}
        {children}
      </div>
    </>,
    document.body
  )
}

export function SheetRow({
  icon,
  label,
  onClick,
  danger,
  trailing,
}: {
  icon?: IconName
  label: string
  onClick?: () => void
  danger?: boolean
  trailing?: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`sheet-row${danger ? ' is-danger' : ''}`}
      onClick={onClick}
    >
      {icon ? <Icon name={icon} size={19} /> : null}
      <span style={{ flex: 1 }}>{label}</span>
      {trailing}
    </button>
  )
}

export function Toast({ text }: { text: string | null }) {
  if (!text) return null
  return createPortal(<div className="toast">{text}</div>, document.body)
}

export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message?: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ padding: '6px 14px 4px' }}>
        <div style={{ fontSize: 17, fontWeight: 650, letterSpacing: '-0.01em' }}>{title}</div>
        {message ? (
          <div style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.55, color: 'var(--muted)' }}>{message}</div>
        ) : null}
      </div>
      <div style={{ marginTop: 10 }}>
        <SheetRow
          label={confirmLabel}
          danger
          onClick={() => {
            onConfirm()
            onClose()
          }}
        />
        <SheetRow label="取消" onClick={onClose} />
      </div>
    </Sheet>
  )
}
