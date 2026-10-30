import React, { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef } from '../../vendor/react.shim.js';
import { highlightMarkdown } from '../lib/highlight.js';
/** strip any existing block marker, keeping indentation */
const MARKER = /^(\s*)(?:#{1,6}\s+|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+|>\s?)?/;
const PREFIX = {
    h1: '# ',
    h2: '## ',
    h3: '### ',
    quote: '> ',
    bullet: '- ',
    ordered: '1. ',
    task: '- [ ] ',
};
export const MarkdownEditor = forwardRef(function MarkdownEditor(props, ref) {
    const taRef = useRef(null);
    const overlayRef = useRef(null);
    const html = useMemo(() => (props.highlight ? highlightMarkdown(props.value) : ''), [props.value, props.highlight]);
    const commit = useCallback((next, selStart, selEnd = selStart) => {
        props.onChange(next);
        requestAnimationFrame(() => {
            const node = taRef.current;
            if (!node)
                return;
            node.focus();
            node.setSelectionRange(selStart, selEnd);
        });
    }, [props]);
    const replaceSelection = useCallback((text, selectStart, selectEnd) => {
        const node = taRef.current;
        if (!node)
            return;
        const start = node.selectionStart;
        const end = node.selectionEnd;
        const next = node.value.slice(0, start) + text + node.value.slice(end);
        commit(next, start + (selectStart !== null && selectStart !== void 0 ? selectStart : text.length), start + (selectEnd !== null && selectEnd !== void 0 ? selectEnd : text.length));
    }, [commit]);
    const wrap = useCallback((before, after, placeholder = '') => {
        const node = taRef.current;
        if (!node)
            return;
        const start = node.selectionStart;
        const end = node.selectionEnd;
        const selected = node.value.slice(start, end);
        const body = selected || placeholder;
        const next = node.value.slice(0, start) + before + body + after + node.value.slice(end);
        const selStart = start + before.length;
        commit(next, selStart, selStart + body.length);
    }, [commit]);
    const formatLines = useCallback((kind) => {
        const node = taRef.current;
        if (!node)
            return;
        const value = node.value;
        const selStart = node.selectionStart;
        const selEnd = node.selectionEnd;
        const lineStart = value.lastIndexOf('\n', Math.max(0, selStart - 1)) + 1;
        let lineEnd = value.indexOf('\n', selEnd > selStart ? selEnd - 1 : selStart);
        if (lineEnd < 0)
            lineEnd = value.length;
        const block = value.slice(lineStart, lineEnd);
        const lines = block.split('\n');
        const want = PREFIX[kind];
        const alreadyAll = kind === 'quote' &&
            lines.every((line) => /^\s*>\s?/.test(line) || line.trim() === '');
        let counter = 0;
        const next = lines
            .map((line) => {
            var _a;
            if (line.trim() === '')
                return line;
            const indent = ((_a = line.match(/^\s*/)) !== null && _a !== void 0 ? _a : [''])[0];
            const body = line.slice(indent.length).replace(MARKER, '');
            if (alreadyAll)
                return indent + body;
            if (kind === 'ordered') {
                counter += 1;
                return `${indent}${counter}. ${body}`;
            }
            return indent + want + body;
        })
            .join('\n');
        const replaced = value.slice(0, lineStart) + next + value.slice(lineEnd);
        const caret = lineStart + next.length;
        commit(replaced, caret, caret);
    }, [commit]);
    useImperativeHandle(ref, () => ({
        el: () => taRef.current,
        focus: () => {
            if (taRef.current)
                taRef.current.focus();
        },
        replaceSelection,
        wrap,
        formatLines,
        setCaret: (pos) => {
            const node = taRef.current;
            if (!node)
                return;
            node.focus();
            const clamped = Math.max(0, Math.min(pos, node.value.length));
            node.setSelectionRange(clamped, clamped);
        },
    }));
    useLayoutEffect(() => {
        const node = taRef.current;
        const overlay = overlayRef.current;
        if (!node || !overlay)
            return;
        overlay.scrollTop = node.scrollTop;
    }, [props.value]);
    const syncScroll = () => {
        const node = taRef.current;
        const overlay = overlayRef.current;
        if (!node || !overlay)
            return;
        overlay.scrollTop = node.scrollTop;
        overlay.scrollLeft = node.scrollLeft;
    };
    const handleKeyDown = (event) => {
        var _a;
        const node = taRef.current;
        if (!node)
            return;
        if (event.key === 'Tab') {
            event.preventDefault();
            const start = node.selectionStart;
            const end = node.selectionEnd;
            const value = node.value;
            if (event.shiftKey) {
                const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
                const remove = value.slice(lineStart, lineStart + 2) === '  ' ? 2 : 0;
                if (remove > 0) {
                    commit(value.slice(0, lineStart) + value.slice(lineStart + remove), Math.max(lineStart, start - remove));
                }
                return;
            }
            commit(value.slice(0, start) + '  ' + value.slice(end), start + 2);
            return;
        }
        if (event.key === 'Enter' && !event.shiftKey && node.selectionStart === node.selectionEnd) {
            const start = node.selectionStart;
            const value = node.value;
            const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
            const line = value.slice(lineStart, start);
            const match = line.match(/^(\s*)(?:([-*+])\s+\[([ xX])\]\s+|([-*+])\s+|(\d+)([.)])\s+|(>)\s?)/);
            if (!match)
                return;
            event.preventDefault();
            const indent = (_a = match[1]) !== null && _a !== void 0 ? _a : '';
            const isEmpty = line.slice(match[0].length).trim().length === 0;
            if (isEmpty) {
                const next = value.slice(0, lineStart) + value.slice(start);
                commit(next, lineStart, lineStart);
                return;
            }
            let marker = '';
            if (match[7])
                marker = '> ';
            else if (match[4])
                marker = match[4] + ' ';
            else if (match[5])
                marker = `${Number(match[5]) + 1}${match[6]} `;
            else if (match[2])
                marker = match[3] ? `${match[2]} [ ] ` : `${match[2]} `;
            const insert = '\n' + indent + marker;
            commit(value.slice(0, start) + insert + value.slice(start), start + insert.length);
        }
    };
    return (React.createElement("div", { className: "editor-wrap" },
        props.highlight ? (React.createElement("div", { ref: overlayRef, className: "editor-overlay no-scrollbar", "aria-hidden": "true" },
            React.createElement("div", { className: "mp-editor-text", style: { minHeight: '100%' }, dangerouslySetInnerHTML: { __html: html + '\n' } }))) : null,
        React.createElement("textarea", { ref: taRef, className: `editor-input mp-editor-text no-scrollbar${props.highlight ? '' : ' is-plain'}`, value: props.value, onChange: (event) => props.onChange(event.target.value), onScroll: syncScroll, onKeyDown: handleKeyDown, spellCheck: false, autoCapitalize: "sentences", autoCorrect: "off", placeholder: props.placeholder })));
});
