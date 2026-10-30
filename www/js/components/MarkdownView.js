import React, { useMemo, useState } from '../../vendor/react.shim.js';
import { tokenizeCode } from '../lib/code.js';
import { copyText } from '../lib/platform.js';
import { Icon } from './Icon.js';
export function MarkdownView({ blocks, onToggleTask, className, }) {
    const ctx = { counter: { n: 0 }, onToggleTask };
    return React.createElement("div", { className: `md-body ${className !== null && className !== void 0 ? className : ''}` }, renderBlocks(blocks, ctx, 'b'));
}
function renderBlocks(blocks, ctx, keyBase) {
    return blocks.map((block, index) => renderBlock(block, ctx, `${keyBase}-${index}`));
}
function renderBlock(block, ctx, key) {
    switch (block.kind) {
        case 'heading': {
            const Tag = `h${Math.min(6, Math.max(1, block.level))}`;
            return (React.createElement(Tag, { key: key, id: block.id }, renderInline(block.inlines, key)));
        }
        case 'paragraph':
            return React.createElement("p", { key: key }, renderInline(block.inlines, key));
        case 'code':
            return React.createElement(CodeBlock, { key: key, code: block.code, lang: block.lang });
        case 'quote':
            return React.createElement("blockquote", { key: key }, renderBlocks(block.blocks, ctx, key));
        case 'list':
            return renderList(block, ctx, key);
        case 'hr':
            return React.createElement("hr", { key: key });
        case 'table':
            return (React.createElement("table", { key: key },
                React.createElement("thead", null,
                    React.createElement("tr", null, block.head.map((cell, i) => {
                        var _a;
                        return (React.createElement("th", { key: i, style: { textAlign: (_a = block.aligns[i]) !== null && _a !== void 0 ? _a : undefined } }, renderInline(cell, `${key}-h-${i}`)));
                    }))),
                React.createElement("tbody", null, block.rows.map((row, r) => (React.createElement("tr", { key: r }, row.map((cell, c) => {
                    var _a;
                    return (React.createElement("td", { key: c, style: { textAlign: (_a = block.aligns[c]) !== null && _a !== void 0 ? _a : undefined } }, renderInline(cell, `${key}-${r}-${c}`)));
                })))))));
        default:
            return null;
    }
}
function renderList(block, ctx, key) {
    const ordered = block.ordered;
    const items = block.items.map((item, index) => renderListItem(item, block.tight, ctx, `${key}-${index}`));
    if (ordered) {
        return (React.createElement("ol", { key: key, start: block.start !== 1 ? block.start : undefined }, items));
    }
    return React.createElement("ul", { key: key }, items);
}
function renderListItem(item, tight, ctx, key) {
    const isTask = item.checked !== null;
    const ordinal = isTask ? ctx.counter.n++ : -1;
    const content = item.blocks.map((block, index) => {
        if (block.kind === 'paragraph' && tight) {
            return React.createElement(React.Fragment, { key: index }, renderInline(block.inlines, `${key}-p-${index}`));
        }
        return renderBlock(block, ctx, `${key}-b-${index}`);
    });
    if (isTask) {
        const done = Boolean(item.checked);
        return (React.createElement("li", { key: key, className: `task-item${done ? ' is-done' : ''}` },
            React.createElement("button", { type: "button", className: `task-box${done ? ' is-done' : ''}`, "aria-pressed": done, "aria-label": done ? '标记为未完成' : '标记为已完成', onClick: () => ctx.onToggleTask && ctx.onToggleTask(ordinal) }, done ? React.createElement(Icon, { name: "check", size: 11, strokeWidth: 3.4 }) : null),
            React.createElement("span", { className: "task-text" }, content)));
    }
    return React.createElement("li", { key: key }, content);
}
function renderInline(inlines, keyBase) {
    return inlines.map((node, index) => {
        const key = `${keyBase}-${index}`;
        switch (node.kind) {
            case 'text':
                return React.createElement(React.Fragment, { key: key }, node.value);
            case 'strong':
                return React.createElement("strong", { key: key }, renderInline(node.children, key));
            case 'em':
                return React.createElement("em", { key: key }, renderInline(node.children, key));
            case 'del':
                return React.createElement("del", { key: key }, renderInline(node.children, key));
            case 'code':
                return React.createElement("code", { key: key }, node.value);
            case 'link':
                return (React.createElement("a", { key: key, href: node.href, target: "_blank", rel: "noreferrer noopener" }, renderInline(node.children, key)));
            case 'image':
                return React.createElement("img", { key: key, src: node.src, alt: node.alt, loading: "lazy" });
            case 'br':
                return React.createElement("br", { key: key });
            default:
                return null;
        }
    });
}
function CodeBlock({ code, lang }) {
    const [copied, setCopied] = useState(false);
    const tokens = useMemo(() => tokenizeCode(code, lang), [code, lang]);
    const copy = () => {
        copyText(code).then((ok) => {
            if (!ok)
                return;
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
        });
    };
    return (React.createElement("pre", null,
        React.createElement("div", { className: "code-head" },
            React.createElement("span", null, lang || 'code'),
            React.createElement("button", { type: "button", onClick: copy, style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    letterSpacing: '0.02em',
                    textTransform: 'none',
                    color: copied ? '#8ce0c2' : '#9aa3b2',
                } },
                React.createElement(Icon, { name: copied ? 'check' : 'copy', size: 12, strokeWidth: 2.2 }),
                copied ? '已复制' : '复制')),
        React.createElement("code", null, tokens.map((token, index) => token.cls ? (React.createElement("span", { key: index, className: token.cls }, token.text)) : (React.createElement(React.Fragment, { key: index }, token.text))))));
}
