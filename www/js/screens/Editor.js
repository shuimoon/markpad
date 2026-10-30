import React, { useCallback, useMemo, useRef, useState } from '../../vendor/react.shim.js';
import { countWords, deriveTitle, readingMinutes, wordLabel } from '../lib/format.js';
import { extractOutline, parseBlocks } from '../lib/markdown.js';
import { exportFile, pickImageFile, shareFile } from '../lib/platform.js';
import { useStore } from '../store.js';
import { Icon } from '../components/Icon.js';
import { MarkdownView } from '../components/MarkdownView.js';
import { MarkdownEditor } from '../components/Editor.js';
import { ConfirmSheet, Sheet, SheetRow } from '../components/Sheet.js';
const MODES = [
    { key: 'edit', label: '编辑' },
    { key: 'split', label: '分屏' },
    { key: 'preview', label: '预览' },
];
export function EditorScreen({ docId, onBack, onOpenSettings, }) {
    const { docs, settings, updateDoc, updateSettings, deleteDoc, duplicateDoc, togglePin, toast } = useStore();
    const doc = docs.find((d) => d.id === docId);
    const [menuOpen, setMenuOpen] = useState(false);
    const [outlineOpen, setOutlineOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [ratio, setRatio] = useState(0.52);
    const editorRef = useRef(null);
    const splitRef = useRef(null);
    const dragRef = useRef(false);
    const mode = settings.mode;
    const content = doc ? doc.content : '';
    const blocks = useMemo(() => parseBlocks(content), [content]);
    const outline = useMemo(() => extractOutline(blocks), [blocks]);
    const words = useMemo(() => countWords(content), [content]);
    const setMode = (next) => updateSettings({ mode: next });
    const toggleTask = useCallback((ordinal) => {
        if (!doc)
            return;
        updateDoc(doc.id, { content: toggleTaskInSource(doc.content, ordinal) });
    }, [doc, updateDoc]);
    const onDragStart = (event) => {
        dragRef.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
    };
    const onDragMove = (event) => {
        if (!dragRef.current || !splitRef.current)
            return;
        const rect = splitRef.current.getBoundingClientRect();
        if (rect.height <= 0)
            return;
        const next = (event.clientY - rect.top) / rect.height;
        setRatio(Math.min(0.78, Math.max(0.24, next)));
    };
    const onDragEnd = () => {
        dragRef.current = false;
    };
    if (!doc) {
        return (React.createElement("div", { className: "screen" },
            React.createElement("div", { className: "empty-state" }, "\u8FD9\u7BC7\u6587\u6863\u5DF2\u7ECF\u4E0D\u5728\u4E86"),
            React.createElement("div", { style: { textAlign: 'center' } },
                React.createElement("button", { type: "button", className: "tool-key", onClick: onBack }, "\u8FD4\u56DE"))));
    }
    const insertTable = () => {
        var _a;
        (_a = editorRef.current) === null || _a === void 0 ? void 0 : _a.replaceSelection('\n| 列一 | 列二 |\n| --- | --- |\n| 内容 | 内容 |\n');
    };
    const insertDivider = () => {
        var _a;
        (_a = editorRef.current) === null || _a === void 0 ? void 0 : _a.replaceSelection('\n---\n');
    };
    const insertLink = () => {
        var _a;
        (_a = editorRef.current) === null || _a === void 0 ? void 0 : _a.wrap('[', '](https://)', '链接文字');
    };
    const insertImage = () => {
        pickImageFile().then((file) => {
            var _a;
            if (!file)
                return;
            if (file.size > 2400000) {
                toast('图片太大（超过 2MB），换一张小一点的');
                return;
            }
            (_a = editorRef.current) === null || _a === void 0 ? void 0 : _a.replaceSelection(`![${file.name || '图片'}](${file.dataUrl})`);
            toast('图片已插入');
        });
    };
    const doExport = () => {
        const message = exportFile(doc.title, doc.content);
        toast(message);
        setMenuOpen(false);
    };
    const doShare = () => {
        setMenuOpen(false);
        shareFile(doc.title, doc.content).then((message) => toast(message));
    };
    const jumpTo = (id) => {
        setOutlineOpen(false);
        if (mode === 'edit') {
            setMode('preview');
            window.setTimeout(() => scrollToHeading(id), 60);
            return;
        }
        scrollToHeading(id);
    };
    const toolbar = [
        { key: 'bold', label: 'B', run: () => { var _a; return (_a = editorRef.current) === null || _a === void 0 ? void 0 : _a.wrap('**', '**', '加粗'); } },
        { key: 'italic', label: 'I', run: () => { var _a; return (_a = editorRef.current) === null || _a === void 0 ? void 0 : _a.wrap('*', '*', '斜体'); } },
        { key: 'strike', label: 'S', run: () => { var _a; return (_a = editorRef.current) === null || _a === void 0 ? void 0 : _a.wrap('~~', '~~', '删除线'); } },
        { key: 'h', label: React.createElement(Icon, { name: "type", size: 17 }), run: () => format('h2') },
        { key: 'quote', label: '❝', run: () => format('quote') },
        { key: 'bullet', label: '•', run: () => format('bullet') },
        { key: 'ordered', label: '1.', run: () => format('ordered') },
        { key: 'task', label: '☑', run: () => format('task') },
        { key: 'code', label: React.createElement(Icon, { name: "code", size: 17 }), run: () => { var _a; return (_a = editorRef.current) === null || _a === void 0 ? void 0 : _a.wrap('`', '`', '代码'); } },
        { key: 'link', label: React.createElement(Icon, { name: "link", size: 17 }), run: insertLink },
        { key: 'image', label: React.createElement(Icon, { name: "image", size: 17 }), run: insertImage },
        { key: 'divider', label: '—', run: insertDivider },
        { key: 'table', label: '▦', run: insertTable },
    ];
    function format(kind) {
        var _a;
        (_a = editorRef.current) === null || _a === void 0 ? void 0 : _a.formatLines(kind);
    }
    const editorPane = (React.createElement(MarkdownEditor, { ref: editorRef, value: doc.content, onChange: (next) => updateDoc(doc.id, { content: next }), highlight: settings.highlight, placeholder: "\u4ECE\u8FD9\u91CC\u5F00\u59CB\u5199\u2026\u2026" }));
    const previewPane = (React.createElement("div", { className: "reader no-scrollbar" },
        React.createElement(MarkdownView, { blocks: blocks, onToggleTask: toggleTask })));
    return (React.createElement("div", { className: "screen" },
        React.createElement("div", { className: "editor-bar" },
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 4 } },
                React.createElement("button", { type: "button", className: "icon-btn", "aria-label": "\u8FD4\u56DE", onClick: onBack },
                    React.createElement(Icon, { name: "back", size: 22 })),
                React.createElement("input", { value: doc.title, onChange: (event) => updateDoc(doc.id, { title: event.target.value }), onBlur: () => {
                        if (!doc.title.trim())
                            updateDoc(doc.id, { title: deriveTitle(doc.content) || '未命名' });
                    }, placeholder: "\u672A\u547D\u540D", "aria-label": "\u6807\u9898", style: {
                        flex: 1,
                        minWidth: 0,
                        border: 0,
                        outline: 0,
                        background: 'transparent',
                        fontSize: 16.5,
                        fontWeight: 620,
                        letterSpacing: '-0.01em',
                        padding: '6px 2px',
                    } }),
                React.createElement("button", { type: "button", className: "icon-btn", "aria-label": "\u66F4\u591A", onClick: () => setMenuOpen(true) },
                    React.createElement(Icon, { name: "more", size: 20 }))),
            React.createElement("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginTop: 6,
                } },
                React.createElement("div", { className: "segmented" }, MODES.map((item) => (React.createElement("button", { key: item.key, type: "button", className: `segmented-item${mode === item.key ? ' is-active' : ''}`, onClick: () => setMode(item.key) }, item.label)))),
                React.createElement("div", { className: "editor-status", style: { padding: 0 } },
                    React.createElement("span", null, wordLabel(words)),
                    React.createElement("span", { style: { opacity: 0.5 } }, "\u00B7"),
                    React.createElement("span", null,
                        readingMinutes(content),
                        " \u5206\u949F")))),
        mode === 'edit' ? React.createElement("div", { style: { flex: 1, minHeight: 0, display: 'flex' } }, editorPane) : null,
        mode === 'preview' ? previewPane : null,
        mode === 'split' ? (React.createElement("div", { className: "split-wrap", ref: splitRef },
            React.createElement("div", { className: "split-pane", style: { flex: `${ratio} 1 0`, display: 'flex', flexDirection: 'column' } }, editorPane),
            React.createElement("div", { className: "split-handle", onPointerDown: onDragStart, onPointerMove: onDragMove, onPointerUp: onDragEnd, onPointerCancel: onDragEnd },
                React.createElement("div", { className: "split-grip" })),
            React.createElement("div", { className: "split-pane", style: {
                    flex: `${1 - ratio} 1 0`,
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'var(--surface)',
                } }, previewPane))) : null,
        mode !== 'preview' ? (React.createElement("div", { className: "toolbar no-scrollbar" }, toolbar.map((item) => (React.createElement("button", { key: item.key, type: "button", className: "tool-key", onMouseDown: (event) => event.preventDefault(), onClick: item.run, "aria-label": item.key }, item.label))))) : null,
        React.createElement(Sheet, { open: menuOpen, onClose: () => setMenuOpen(false), title: doc.title || '未命名' },
            React.createElement(SheetRow, { icon: "outline", label: "\u5927\u7EB2", trailing: React.createElement("span", { style: { color: 'var(--faint)', fontSize: 12.5 } }, outline.length), onClick: () => {
                    setMenuOpen(false);
                    if (outline.length === 0) {
                        toast('这篇还没有标题');
                        return;
                    }
                    setOutlineOpen(true);
                } }),
            React.createElement(SheetRow, { icon: "pin", label: doc.pinned ? '取消置顶' : '置顶', onClick: () => {
                    togglePin(doc.id);
                    setMenuOpen(false);
                } }),
            React.createElement(SheetRow, { icon: "share", label: "\u5206\u4EAB", onClick: doShare }),
            React.createElement(SheetRow, { icon: "download", label: "\u5BFC\u51FA .md", onClick: doExport }),
            React.createElement(SheetRow, { icon: "copy", label: "\u590D\u5236\u4E00\u4EFD", onClick: () => {
                    const copy = duplicateDoc(doc.id);
                    setMenuOpen(false);
                    if (copy)
                        toast('已复制');
                } }),
            React.createElement(SheetRow, { icon: "sliders", label: "\u9605\u8BFB\u8BBE\u7F6E", onClick: () => {
                    setMenuOpen(false);
                    onOpenSettings();
                } }),
            React.createElement(SheetRow, { icon: "trash", label: "\u5220\u9664", danger: true, onClick: () => {
                    setMenuOpen(false);
                    setConfirmOpen(true);
                } })),
        React.createElement(Sheet, { open: outlineOpen, onClose: () => setOutlineOpen(false), title: "\u5927\u7EB2" },
            React.createElement("div", { style: { maxHeight: '56vh', overflowY: 'auto' }, className: "no-scrollbar" }, outline.map((item) => (React.createElement("button", { key: item.id, type: "button", className: "sheet-row", style: { paddingLeft: 12 + (item.level - 1) * 14 }, onClick: () => jumpTo(item.id) },
                React.createElement("span", { style: {
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: item.level === 1 ? 600 : 450,
                        fontSize: item.level === 1 ? 15 : 14,
                    } }, item.text)))))),
        React.createElement(ConfirmSheet, { open: confirmOpen, title: "\u5220\u9664\u8FD9\u7BC7\u6587\u6863\uFF1F", message: "\u5220\u9664\u540E\u65E0\u6CD5\u6062\u590D\uFF0C\u5EFA\u8BAE\u5148\u5BFC\u51FA\u5907\u4EFD\u3002", confirmLabel: "\u5220\u9664", onClose: () => setConfirmOpen(false), onConfirm: () => {
                deleteDoc(doc.id);
                toast('已删除');
                onBack();
            } })));
}
function scrollToHeading(id) {
    const el = document.getElementById(id);
    if (el)
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
const TASK_LINE = /^(\s*(?:>\s*)*)([-*+])\s+\[([ xX])\]\s/;
export function toggleTaskInSource(source, ordinal) {
    const lines = source.split('\n');
    let seen = -1;
    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(TASK_LINE);
        if (!match)
            continue;
        seen += 1;
        if (seen !== ordinal)
            continue;
        const done = match[3].toLowerCase() === 'x';
        lines[i] = lines[i].replace(/\[([ xX])\]/, done ? '[ ]' : '[x]');
        return lines.join('\n');
    }
    return source;
}
