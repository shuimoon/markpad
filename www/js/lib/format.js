const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff]/g;
export function countWords(text) {
    var _a, _b;
    if (!text)
        return 0;
    const cjk = (_b = (_a = text.match(CJK)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
    const rest = text.replace(CJK, ' ');
    const latin = rest.split(/\s+/).filter((w) => /[A-Za-z0-9_'-]/.test(w)).length;
    return cjk + latin;
}
export function readingMinutes(text) {
    var _a, _b;
    const cjk = (_b = (_a = text.match(CJK)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
    const rest = text.replace(CJK, ' ');
    const words = rest.split(/\s+/).filter((w) => /[A-Za-z0-9_'-]/.test(w)).length;
    const minutes = cjk / 420 + words / 220;
    return Math.max(1, Math.round(minutes));
}
function pad(n) {
    return n < 10 ? `0${n}` : String(n);
}
export function formatDate(ts, now = Date.now()) {
    const d = new Date(ts);
    const n = new Date(now);
    const sameDay = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
    if (sameDay)
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const yesterday = new Date(now - 86400000);
    const isYesterday = d.getFullYear() === yesterday.getFullYear() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getDate() === yesterday.getDate();
    if (isYesterday)
        return '昨天';
    if (d.getFullYear() === n.getFullYear())
        return `${d.getMonth() + 1}月${d.getDate()}日`;
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
const CJK_PAIR = /([\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]) (?=[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef])/g;
function stripInline(s) {
    return s
        .replace(/`([^`]*)`/g, '$1')
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/~~([^~]+)~~/g, '$1')
        .replace(/(^|\s)_([^_]+)_(?=\s|$)/g, '$1$2')
        .replace(/\\([\\`*_{}[\]()#+\-.!~>|])/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}
export function stripMarkdown(text, limit = 180) {
    const blocks = [];
    let paragraph = '';
    let fenced = false;
    const flush = () => {
        const value = stripInline(paragraph).replace(CJK_PAIR, '$1').trim();
        if (value)
            blocks.push(value);
        paragraph = '';
    };
    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (/^(```|~~~)/.test(line)) {
            fenced = !fenced;
            flush();
            continue;
        }
        if (fenced)
            continue;
        if (!line) {
            flush();
            continue;
        }
        if (/^\|/.test(line))
            continue;
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
            flush();
            continue;
        }
        const heading = line.match(/^#{1,6}\s+(.*)$/);
        if (heading) {
            flush();
            blocks.push(stripInline(heading[1]));
            continue;
        }
        const item = line.match(/^(?:>|([-*+]|\d{1,9}\.)\s+)\s*(.*)$/);
        if (item) {
            flush();
            const body = item[2].replace(/^\[[ xX]\]\s*/, '');
            const value = stripInline(body);
            if (value)
                blocks.push(value);
            continue;
        }
        paragraph = paragraph ? `${paragraph} ${line}` : line;
    }
    flush();
    const plain = blocks.filter(Boolean).join(' · ').replace(/\s+/g, ' ');
    return plain.length > limit ? `${plain.slice(0, limit)}…` : plain;
}
export function deriveTitle(content, fallback = '') {
    const heading = content.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/m);
    if (heading)
        return cleanup(heading[1]);
    const firstLine = content
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 0);
    if (firstLine)
        return cleanup(firstLine);
    return fallback;
}
function cleanup(s) {
    return s
        .replace(/[*_`~[\]]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60);
}
export function wordLabel(count) {
    if (count < 1000)
        return `${count} 字`;
    return `${(count / 1000).toFixed(1)}k 字`;
}
export function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
