import { filesFromFileList, normalizeText, pickFilesElement, pickFolderElement } from './importers.js';
export function bridge() {
    var _a;
    if (typeof window === 'undefined')
        return null;
    return (_a = window.MarkPad) !== null && _a !== void 0 ? _a : null;
}
export function isNative() {
    return bridge() !== null;
}
export function safeFileName(title) {
    const base = (title || '').trim().replace(/[\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ');
    const trimmed = base.slice(0, 60).trim() || '未命名';
    return trimmed.toLowerCase().endsWith('.md') ? trimmed : `${trimmed}.md`;
}
function downloadBlob(name, content) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}
/** Export a markdown file. Returns a short status message for the toast. */
export function exportFile(title, content) {
    const name = safeFileName(title);
    const b = bridge();
    if (b) {
        try {
            const path = b.saveFile(name, content);
            return path ? `已保存到 ${path}` : '已保存到下载目录';
        }
        catch {
            return '保存失败';
        }
    }
    downloadBlob(name, content);
    return '已下载 ' + name;
}
export async function shareFile(title, content) {
    const name = safeFileName(title);
    const b = bridge();
    if (b) {
        try {
            b.shareFile(name, content);
            return '正在分享';
        }
        catch {
            return '分享失败';
        }
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
            await navigator.share({ title, text: content });
            return '已分享';
        }
        catch {
            return '已取消分享';
        }
    }
    downloadBlob(name, content);
    return '已下载 ' + name;
}
export function haptic() {
    const b = bridge();
    if (b && b.haptic) {
        try {
            b.haptic();
            return;
        }
        catch {
            /* ignore */
        }
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(8);
    }
}
/** Pick one or more .md/.txt files. */
export function pickMarkdownFiles() {
    return pickFilesElement().then((list) => filesFromFileList(list));
}
/**
 * Pick a folder. On Android the WebView cannot open a directory picker, so the
 * native SAF bridge does the walking and calls back into `window.__markpadFolder`.
 */
export function pickMarkdownFolder() {
    const native = bridge();
    if (native && typeof native.pickFolder === 'function')
        return pickFolderNative();
    return pickFolderElement().then((list) => filesFromFileList(list).then((files) => ({ files, truncated: false })));
}
function parseFolderPayload(payload) {
    var _a, _b, _c;
    let data = payload;
    if (typeof payload === 'string') {
        try {
            data = JSON.parse(payload);
        }
        catch {
            data = null;
        }
    }
    const source = Array.isArray(data)
        ? data
        : data && typeof data === 'object' && Array.isArray(data.files)
            ? (data.files)
            : [];
    const files = [];
    for (const item of source) {
        if (!item || typeof item !== 'object')
            continue;
        const record = item;
        if (typeof record.content !== 'string')
            continue;
        const name = String((_b = (_a = record.name) !== null && _a !== void 0 ? _a : record.path) !== null && _b !== void 0 ? _b : '');
        if (!name)
            continue;
        files.push({
            name,
            path: String((_c = record.path) !== null && _c !== void 0 ? _c : name),
            content: normalizeText(record.content),
        });
    }
    const truncated = Boolean(data && typeof data === 'object' && data.truncated);
    return { files, truncated };
}
function pickFolderNative() {
    return new Promise((resolve) => {
        var _a, _b;
        const previous = window.__markpadFolder;
        let settled = false;
        const timer = window.setTimeout(() => finish({ files: [], truncated: false }), 5 * 60 * 1000);
        function finish(result) {
            if (settled)
                return;
            settled = true;
            window.clearTimeout(timer);
            window.__markpadFolder = previous;
            resolve(result);
        }
        window.__markpadFolder = (payload) => finish(parseFolderPayload(payload));
        try {
            (_b = (_a = bridge()) === null || _a === void 0 ? void 0 : _a.pickFolder) === null || _b === void 0 ? void 0 : _b.call(_a);
        }
        catch {
            finish({ files: [], truncated: false });
        }
    });
}
export function pickImageFile() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        document.body.appendChild(input);
        let settled = false;
        const cleanup = () => {
            if (input.parentNode)
                input.parentNode.removeChild(input);
        };
        const finish = (file) => {
            if (settled)
                return;
            settled = true;
            if (!file) {
                cleanup();
                resolve(null);
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                var _a;
                cleanup();
                resolve({ name: file.name.replace(/\.[a-z0-9]+$/i, ''), dataUrl: String((_a = reader.result) !== null && _a !== void 0 ? _a : ''), size: file.size });
            };
            reader.onerror = () => {
                cleanup();
                resolve(null);
            };
            reader.readAsDataURL(file);
        };
        input.addEventListener('change', () => finish(input.files && input.files[0]));
        window.addEventListener('focus', () => {
            setTimeout(() => finish(input.files && input.files[0]), 700);
        }, { once: true });
        input.click();
    });
}
export function syncSystemBars(dark, color) {
    const meta = document.getElementById('meta-theme-color');
    if (meta)
        meta.setAttribute('content', color);
    const b = bridge();
    if (b && b.setBars) {
        try {
            b.setBars(dark ? '1' : '0', color);
        }
        catch {
            /* ignore */
        }
    }
}
export function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(() => true, () => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
}
function fallbackCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
        ok = document.execCommand('copy');
    }
    catch {
        ok = false;
    }
    document.body.removeChild(area);
    return ok;
}
