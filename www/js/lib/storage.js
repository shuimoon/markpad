const DOCS_KEY = 'markpad.docs.v1';
const SETTINGS_KEY = 'markpad.settings.v1';
const SEED_KEY = 'markpad.seeded.v1';
function readJson(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw)
            return null;
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    }
    catch {
        /* quota exceeded — keep the app usable */
    }
}
export function loadDocs() {
    const docs = readJson(DOCS_KEY);
    if (!Array.isArray(docs))
        return null;
    return docs
        .filter((d) => d && typeof d.id === 'string')
        .map((d) => ({
        id: d.id,
        title: typeof d.title === 'string' ? d.title : '',
        content: typeof d.content === 'string' ? d.content : '',
        createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
        updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now(),
        pinned: Boolean(d.pinned),
    }));
}
export function saveDocs(docs) {
    writeJson(DOCS_KEY, docs);
}
export function loadSettings() {
    return readJson(SETTINGS_KEY);
}
export function saveSettings(settings) {
    writeJson(SETTINGS_KEY, settings);
}
export function hasSeeded() {
    try {
        return localStorage.getItem(SEED_KEY) === '1';
    }
    catch {
        return true;
    }
}
export function markSeeded() {
    try {
        localStorage.setItem(SEED_KEY, '1');
    }
    catch {
        /* ignore */
    }
}
export function newId() {
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 7);
    return `${t}${r}`;
}
