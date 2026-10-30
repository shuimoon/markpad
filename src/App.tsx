import React, { useEffect, useRef, useState } from 'react'
import { StoreProvider, useStore } from './store.js'
import { LibraryScreen } from './screens/Library.js'
import { EditorScreen } from './screens/Editor.js'
import { SettingsScreen } from './screens/Settings.js'
import { Toast } from './components/Sheet.js'
import { closeTopSheet } from './components/Sheet.js'

type Route = { name: 'library' } | { name: 'doc'; id: string } | { name: 'settings' }

function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '')
  if (clean.startsWith('doc/')) return { name: 'doc', id: decodeURIComponent(clean.slice(4)) }
  if (clean.startsWith('settings')) return { name: 'settings' }
  return { name: 'library' }
}

function depthOf(route: Route): number {
  return route.name === 'library' ? 0 : 1
}

function routeKey(route: Route): string {
  return route.name === 'doc' ? `doc-${route.id}` : route.name
}

function Router() {
  const { toastText } = useStore()
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  const [animClass, setAnimClass] = useState('')
  const [animToken, setAnimToken] = useState(0)
  const depthRef = useRef(depthOf(parseHash(window.location.hash)))

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#/')
    }
    const onHash = () => {
      const next = parseHash(window.location.hash)
      const nextDepth = depthOf(next)
      let cls = ''
      if (nextDepth > depthRef.current) cls = 'screen-enter-forward'
      else if (nextDepth < depthRef.current) cls = 'screen-enter-back'
      depthRef.current = nextDepth
      setAnimClass(cls)
      setAnimToken((token) => token + 1)
      setRoute(next)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const openDoc = (id: string) => {
    window.location.hash = `#/doc/${encodeURIComponent(id)}`
  }
  const openSettings = () => {
    window.location.hash = '#/settings'
  }
  const back = () => {
    if (window.history.length > 1) window.history.back()
    else window.location.hash = '#/'
  }

  // Hardware back button on Android: let the page decide before the activity closes.
  useEffect(() => {
    window.__markpadBack = () => {
      if (closeTopSheet()) return true
      if (parseHash(window.location.hash).name !== 'library') {
        window.location.hash = '#/'
        return true
      }
      return false
    }
    return () => {
      delete window.__markpadBack
    }
  }, [])

  const screen =
    route.name === 'library' ? (
      <LibraryScreen onOpen={openDoc} onSettings={openSettings} />
    ) : route.name === 'doc' ? (
      <EditorScreen docId={route.id} onBack={back} onOpenSettings={openSettings} />
    ) : (
      <SettingsScreen onBack={back} />
    )

  return (
    <div className="app-shell">
      <div key={`${routeKey(route)}-${animToken}`} className={`screen-host ${animClass}`}>
        {screen}
      </div>
      <Toast text={toastText} />
    </div>
  )
}

export function App() {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  )
}
