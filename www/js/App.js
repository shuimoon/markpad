import React, { useEffect, useRef, useState } from '../vendor/react.shim.js';
import { StoreProvider, useStore } from './store.js';
import { LibraryScreen } from './screens/Library.js';
import { EditorScreen } from './screens/Editor.js';
import { SettingsScreen } from './screens/Settings.js';
import { Toast } from './components/Sheet.js';
import { closeTopSheet } from './components/Sheet.js';
function parseHash(hash) {
    const clean = hash.replace(/^#\/?/, '');
    if (clean.startsWith('doc/'))
        return { name: 'doc', id: decodeURIComponent(clean.slice(4)) };
    if (clean.startsWith('settings'))
        return { name: 'settings' };
    return { name: 'library' };
}
function depthOf(route) {
    return route.name === 'library' ? 0 : 1;
}
function routeKey(route) {
    return route.name === 'doc' ? `doc-${route.id}` : route.name;
}
function Router() {
    const { toastText } = useStore();
    const [route, setRoute] = useState(() => parseHash(window.location.hash));
    const [animClass, setAnimClass] = useState('');
    const [animToken, setAnimToken] = useState(0);
    const depthRef = useRef(depthOf(parseHash(window.location.hash)));
    useEffect(() => {
        if (!window.location.hash) {
            window.history.replaceState(null, '', '#/');
        }
        const onHash = () => {
            const next = parseHash(window.location.hash);
            const nextDepth = depthOf(next);
            let cls = '';
            if (nextDepth > depthRef.current)
                cls = 'screen-enter-forward';
            else if (nextDepth < depthRef.current)
                cls = 'screen-enter-back';
            depthRef.current = nextDepth;
            setAnimClass(cls);
            setAnimToken((token) => token + 1);
            setRoute(next);
        };
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, []);
    const openDoc = (id) => {
        window.location.hash = `#/doc/${encodeURIComponent(id)}`;
    };
    const openSettings = () => {
        window.location.hash = '#/settings';
    };
    const back = () => {
        if (window.history.length > 1)
            window.history.back();
        else
            window.location.hash = '#/';
    };
    // Hardware back button on Android: let the page decide before the activity closes.
    useEffect(() => {
        window.__markpadBack = () => {
            if (closeTopSheet())
                return true;
            if (parseHash(window.location.hash).name !== 'library') {
                window.location.hash = '#/';
                return true;
            }
            return false;
        };
        return () => {
            delete window.__markpadBack;
        };
    }, []);
    const screen = route.name === 'library' ? (React.createElement(LibraryScreen, { onOpen: openDoc, onSettings: openSettings })) : route.name === 'doc' ? (React.createElement(EditorScreen, { docId: route.id, onBack: back, onOpenSettings: openSettings })) : (React.createElement(SettingsScreen, { onBack: back }));
    return (React.createElement("div", { className: "app-shell" },
        React.createElement("div", { key: `${routeKey(route)}-${animToken}`, className: `screen-host ${animClass}` }, screen),
        React.createElement(Toast, { text: toastText })));
}
export function App() {
    return (React.createElement(StoreProvider, null,
        React.createElement(Router, null)));
}
