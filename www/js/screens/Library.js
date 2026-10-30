import React, { useMemo, useRef, useState } from '../../vendor/react.shim.js';
import { countWords, formatDate, stripMarkdown, wordLabel } from '../lib/format.js';
import { describeImport, filesFromDataTransfer } from '../lib/importers.js';
import { pickMarkdownFiles } from '../lib/platform.js';
import { useStore } from '../store.js';
import { Icon } from '../components/Icon.js';
export function LibraryScreen({ onOpen, onSettings, }) {
    const { docs, createDoc, importFiles, toast } = useStore();
    const [query, setQuery] = useState('');
    const [focused, setFocused] = useState(false);
    const [dropActive, setDropActive] = useState(false);
    const inputRef = useRef(null);
    const dragDepth = useRef(0);
    const trimmed = query.trim();
    const searching = trimmed.length > 0;
    const groups = useMemo(() => {
        const list = docs.slice().sort((a, b) => b.updatedAt - a.updatedAt);
        if (searching) {
            const needle = trimmed.toLowerCase();
            const hits = list.filter((doc) => doc.title.toLowerCase().indexOf(needle) >= 0 || doc.content.toLowerCase().indexOf(needle) >= 0);
            return { pinned: [], others: hits };
        }
        return {
            pinned: list.filter((doc) => doc.pinned),
            others: list.filter((doc) => !doc.pinned),
        };
    }, [docs, searching, trimmed]);
    const total = groups.pinned.length + groups.others.length;
    const startNew = () => {
        const doc = createDoc();
        onOpen(doc.id);
    };
    const importFromPicker = () => {
        pickMarkdownFiles().then((files) => {
            if (files.length === 0)
                return;
            toast(describeImport(importFiles(files)));
        });
    };
    const hasFiles = (event) => {
        const types = event.dataTransfer ? Array.from(event.dataTransfer.types) : [];
        return types.indexOf('Files') >= 0;
    };
    const handleDragEnter = (event) => {
        if (!hasFiles(event))
            return;
        event.preventDefault();
        dragDepth.current += 1;
        setDropActive(true);
    };
    const handleDragOver = (event) => {
        if (!hasFiles(event))
            return;
        event.preventDefault();
        if (event.dataTransfer)
            event.dataTransfer.dropEffect = 'copy';
    };
    const handleDragLeave = () => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0)
            setDropActive(false);
    };
    const handleDrop = (event) => {
        if (!hasFiles(event))
            return;
        event.preventDefault();
        dragDepth.current = 0;
        setDropActive(false);
        const transfer = event.dataTransfer;
        filesFromDataTransfer(transfer).then((files) => {
            if (files.length === 0) {
                toast('没有找到 .md 文件');
                return;
            }
            toast(describeImport(importFiles(files)));
        });
    };
    const renderCard = (doc) => (React.createElement("button", { key: doc.id, type: "button", className: "doc-card pressable", onClick: () => onOpen(doc.id) },
        React.createElement("div", { style: { display: 'flex', alignItems: 'flex-start', gap: 8 } },
            React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                React.createElement("div", { className: "doc-title" }, highlightText(doc.title || '未命名', trimmed)),
                React.createElement("div", { className: "doc-excerpt", style: { marginTop: 5 } }, excerptFor(doc, trimmed))),
            doc.pinned ? (React.createElement("span", { style: { color: 'var(--accent)', marginTop: 2, flex: 'none' } },
                React.createElement(Icon, { name: "pin", size: 14, strokeWidth: 2.1 }))) : null),
        React.createElement("div", { className: "doc-meta", style: { marginTop: 10, display: 'flex', alignItems: 'center', gap: 7 } },
            React.createElement("span", null, formatDate(doc.updatedAt)),
            React.createElement("span", { style: { opacity: 0.55 } }, "\u00B7"),
            React.createElement("span", null, wordLabel(countWords(doc.content))))));
    return (React.createElement("div", { className: "screen", onDragEnter: handleDragEnter, onDragOver: handleDragOver, onDragLeave: handleDragLeave, onDrop: handleDrop },
        React.createElement("div", { className: "lib-header" },
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } },
                React.createElement("h1", { className: "lib-title" }, "MarkPad"),
                React.createElement("button", { type: "button", className: "icon-btn", "aria-label": "\u8BBE\u7F6E", onClick: onSettings },
                    React.createElement(Icon, { name: "sliders", size: 20 }))),
            React.createElement("div", { className: `search-shell${focused ? ' is-focused' : ''}`, style: { marginTop: 14 } },
                React.createElement(Icon, { name: "search", size: 16, strokeWidth: 2.1 }),
                React.createElement("input", { ref: inputRef, className: "search-input", value: query, placeholder: "\u641C\u7D22\u6807\u9898\u4E0E\u5185\u5BB9", onChange: (event) => setQuery(event.target.value), onFocus: () => setFocused(true), onBlur: () => setFocused(false), enterKeyHint: "search", type: "search" }),
                query ? (React.createElement("button", { type: "button", "aria-label": "\u6E05\u7A7A", style: { display: 'grid', placeItems: 'center', color: 'var(--faint)' }, onClick: () => {
                        setQuery('');
                        if (inputRef.current)
                            inputRef.current.focus();
                    } },
                    React.createElement(Icon, { name: "close", size: 15, strokeWidth: 2.2 }))) : null)),
        React.createElement("div", { className: "no-scrollbar", style: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 16px calc(var(--safe-bottom) + 110px)' } },
            total === 0 && searching ? (React.createElement("div", { className: "empty-state" },
                React.createElement("div", { style: { fontSize: 15, color: 'var(--muted)' } },
                    "\u6CA1\u6709\u627E\u5230 \u201C",
                    trimmed,
                    "\u201D"),
                React.createElement("div", { style: { marginTop: 6, fontSize: 13 } }, "\u8BD5\u8BD5\u522B\u7684\u5173\u952E\u8BCD"))) : null,
            total === 0 && !searching ? (React.createElement("div", { className: "empty-state" },
                React.createElement("div", { style: { fontSize: 15, color: 'var(--muted)' } }, "\u8FD8\u6CA1\u6709\u4EFB\u4F55\u6587\u6863"),
                React.createElement("div", { style: { marginTop: 6, fontSize: 13 } }, "\u70B9\u53F3\u4E0B\u89D2\u7684 + \u5199\u4E0B\u7B2C\u4E00\u7BC7"),
                React.createElement("button", { type: "button", className: "empty-action", onClick: importFromPicker },
                    React.createElement(Icon, { name: "upload", size: 15 }),
                    "\u5BFC\u5165 .md \u6587\u4EF6"))) : null,
            groups.pinned.length > 0 ? (React.createElement("section", { style: { marginBottom: 22 } },
                React.createElement("div", { className: "section-label", style: { padding: '0 4px 9px' } }, "\u7F6E\u9876"),
                React.createElement("div", { style: { display: 'grid', gap: 10 } }, groups.pinned.map(renderCard)))) : null,
            groups.others.length > 0 ? (React.createElement("section", null,
                React.createElement("div", { className: "section-label", style: { padding: '0 4px 9px', display: 'flex', justifyContent: 'space-between' } },
                    React.createElement("span", null, searching ? `搜索结果 · ${groups.others.length}` : groups.pinned.length > 0 ? '全部文档' : '我的文档'),
                    !searching && docs.length > 0 ? React.createElement("span", { style: { textTransform: 'none', letterSpacing: 0 } },
                        docs.length,
                        " \u7BC7") : null),
                React.createElement("div", { style: { display: 'grid', gap: 10 } }, groups.others.map(renderCard)))) : null),
        React.createElement("button", { type: "button", className: "fab", "aria-label": "\u65B0\u5EFA\u6587\u6863", onClick: startNew },
            React.createElement(Icon, { name: "plus", size: 25, strokeWidth: 2.2 })),
        dropActive ? (React.createElement("div", { className: "drop-veil" },
            React.createElement("div", { className: "drop-veil-card" },
                React.createElement(Icon, { name: "upload", size: 22, strokeWidth: 2 }),
                React.createElement("div", { style: { fontSize: 15, fontWeight: 600, marginTop: 8 } }, "\u677E\u624B\u5BFC\u5165"),
                React.createElement("div", { style: { fontSize: 12.5, marginTop: 4, color: 'var(--muted)' } }, "\u6587\u4EF6\u6216\u6574\u4E2A\u6587\u4EF6\u5939\u90FD\u53EF\u4EE5")))) : null));
}
function highlightText(text, query) {
    if (!query)
        return text;
    const lower = text.toLowerCase();
    const needle = query.toLowerCase();
    const parts = [];
    let cursor = 0;
    let index = lower.indexOf(needle);
    while (index >= 0) {
        if (index > cursor)
            parts.push(text.slice(cursor, index));
        parts.push(React.createElement("mark", { className: "mark", key: `m-${index}` }, text.slice(index, index + needle.length)));
        cursor = index + needle.length;
        index = lower.indexOf(needle, cursor);
    }
    if (cursor < text.length)
        parts.push(text.slice(cursor));
    return parts;
}
function excerptFor(doc, query) {
    const plain = stripMarkdown(doc.content, 4000);
    if (!plain)
        return '空白文档';
    if (!query)
        return plain.slice(0, 110) + (plain.length > 110 ? '…' : '');
    const lower = plain.toLowerCase();
    const index = lower.indexOf(query.toLowerCase());
    if (index < 0)
        return plain.slice(0, 110) + (plain.length > 110 ? '…' : '');
    const start = Math.max(0, index - 34);
    const end = Math.min(plain.length, index + query.length + 78);
    const slice = plain.slice(start, end);
    return (React.createElement(React.Fragment, null,
        start > 0 ? '…' : '',
        highlightText(slice, query),
        end < plain.length ? '…' : ''));
}
