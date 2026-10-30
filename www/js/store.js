import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from '../vendor/react.shim.js';
import { hasSeeded, loadDocs, loadSettings, markSeeded, newId, saveDocs, saveSettings, } from './lib/storage.js';
import { buildSamples } from './lib/samples.js';
import { deriveTitle } from './lib/format.js';
import { mergeImportedFiles } from './lib/importers.js';
import { syncSystemBars } from './lib/platform.js';
export const DEFAULT_SETTINGS = {
    theme: 'light',
    fontFamily: 'sans',
    fontSize: 16,
    lineHeight: 1.75,
    margin: 'normal',
    highlight: true,
    mode: 'split',
};
const CANVAS = {
    light: '#f4f3ef',
    sepia: '#f2e8d8',
    dark: '#0e0f11',
};
const SERIF = '"Songti SC", "Noto Serif SC", Georgia, "Times New Roman", serif';
const MARGIN = { narrow: '14px', normal: '20px', wide: '30px' };
const StoreContext = createContext(null);
function bootstrapDocs() {
    const stored = loadDocs();
    if (stored && stored.length > 0)
        return stored;
    if (stored && stored.length === 0 && hasSeeded())
        return [];
    const samples = buildSamples(Date.now());
    markSeeded();
    return samples;
}
function bootstrapSettings() {
    const stored = loadSettings();
    return { ...DEFAULT_SETTINGS, ...(stored !== null && stored !== void 0 ? stored : {}) };
}
export function StoreProvider({ children }) {
    const [docs, setDocs] = useState(bootstrapDocs);
    const [settings, setSettings] = useState(bootstrapSettings);
    const [toastText, setToastText] = useState(null);
    const toastTimer = useRef(null);
    const saveTimer = useRef(null);
    const toast = useCallback((text) => {
        setToastText(text);
        if (toastTimer.current !== null)
            window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToastText(null), 1900);
    }, []);
    useEffect(() => {
        if (saveTimer.current !== null)
            window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => saveDocs(docs), 240);
        return () => {
            if (saveTimer.current !== null)
                window.clearTimeout(saveTimer.current);
        };
    }, [docs]);
    useEffect(() => {
        saveSettings(settings);
    }, [settings]);
    useEffect(() => {
        var _a, _b;
        const root = document.documentElement;
        root.setAttribute('data-theme', settings.theme);
        root.style.setProperty('--read-font-size', `${settings.fontSize}px`);
        root.style.setProperty('--read-line-height', String(settings.lineHeight));
        root.style.setProperty('--read-margin', (_a = MARGIN[settings.margin]) !== null && _a !== void 0 ? _a : '20px');
        root.style.setProperty('--read-font-family', settings.fontFamily === 'serif'
            ? SERIF
            : '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif');
        const canvas = (_b = CANVAS[settings.theme]) !== null && _b !== void 0 ? _b : CANVAS.light;
        root.style.backgroundColor = canvas;
        document.body.style.backgroundColor = canvas;
        syncSystemBars(settings.theme === 'dark', canvas);
    }, [settings]);
    useEffect(() => {
        return () => {
            if (toastTimer.current !== null)
                window.clearTimeout(toastTimer.current);
            if (saveTimer.current !== null)
                window.clearTimeout(saveTimer.current);
        };
    }, []);
    const createDoc = useCallback((content = '', title = '') => {
        const now = Date.now();
        const doc = {
            id: newId(),
            title: title || deriveTitle(content) || '未命名',
            content,
            createdAt: now,
            updatedAt: now,
            pinned: false,
        };
        setDocs((prev) => [doc, ...prev]);
        return doc;
    }, []);
    const updateDoc = useCallback((id, patch) => {
        const now = Date.now();
        setDocs((prev) => prev.map((doc) => {
            if (doc.id !== id)
                return doc;
            const next = { ...doc, ...patch, updatedAt: now };
            if (patch.content !== undefined && (doc.title === '' || doc.title === '未命名')) {
                const derived = deriveTitle(patch.content);
                if (derived)
                    next.title = derived;
            }
            return next;
        }));
    }, []);
    const deleteDoc = useCallback((id) => {
        setDocs((prev) => prev.filter((doc) => doc.id !== id));
    }, []);
    const duplicateDoc = useCallback((id) => {
        let copy = null;
        setDocs((prev) => {
            const source = prev.find((doc) => doc.id === id);
            if (!source)
                return prev;
            const now = Date.now();
            copy = { ...source, id: newId(), title: `${source.title} 副本`, pinned: false, createdAt: now, updatedAt: now };
            return [copy, ...prev];
        });
        return copy;
    }, []);
    const togglePin = useCallback((id) => {
        setDocs((prev) => prev.map((doc) => (doc.id === id ? { ...doc, pinned: !doc.pinned } : doc)));
    }, []);
    const importFiles = useCallback((files) => {
        const result = mergeImportedFiles(docs, files);
        if (result.addedCount > 0)
            setDocs((prev) => [...result.added, ...prev]);
        return result;
    }, [docs]);
    const updateSettings = useCallback((patch) => {
        setSettings((prev) => ({ ...prev, ...patch }));
    }, []);
    const getDoc = useCallback((id) => docs.find((doc) => doc.id === id), [docs]);
    const value = useMemo(() => ({
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
    }), [
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
    ]);
    return React.createElement(StoreContext.Provider, { value: value }, children);
}
export function useStore() {
    const ctx = useContext(StoreContext);
    if (!ctx)
        throw new Error('useStore must be used inside StoreProvider');
    return ctx;
}
