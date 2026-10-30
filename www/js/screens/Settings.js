import React from '../../vendor/react.shim.js';
import { describeImport } from '../lib/importers.js';
import { exportFile, isNative, pickMarkdownFiles, pickMarkdownFolder } from '../lib/platform.js';
import { useStore } from '../store.js';
import { Icon } from '../components/Icon.js';
const THEMES = [
    { key: 'light', label: '浅色' },
    { key: 'sepia', label: '护眼' },
    { key: 'dark', label: '深色' },
];
const FONTS = [
    { key: 'sans', label: '无衬线' },
    { key: 'serif', label: '衬线' },
];
const MARGINS = [
    { key: 'narrow', label: '窄' },
    { key: 'normal', label: '标准' },
    { key: 'wide', label: '宽' },
];
export function SettingsScreen({ onBack }) {
    const { settings, updateSettings, docs, importFiles, toast } = useStore();
    const importNow = () => {
        pickMarkdownFiles().then((files) => {
            if (files.length === 0)
                return;
            toast(describeImport(importFiles(files)));
        });
    };
    const importFolderNow = () => {
        toast('正在读取文件夹…');
        pickMarkdownFolder().then((picked) => {
            if (picked.files.length === 0) {
                toast(picked.truncated ? '文件夹太深了，换一个试试' : '这个文件夹里没有 .md 文件');
                return;
            }
            const result = importFiles(picked.files);
            toast(describeImport({ ...result, truncated: result.truncated || picked.truncated }));
        });
    };
    const exportAll = () => {
        if (docs.length === 0) {
            toast('还没有可导出的文档');
            return;
        }
        const sorted = docs.slice().sort((a, b) => a.createdAt - b.createdAt);
        const body = sorted
            .map((doc) => `# ${doc.title || '未命名'}\n\n${doc.content.trim()}\n`)
            .join('\n\n---\n\n');
        const message = exportFile('MarkPad 备份', `<!-- MarkPad 备份 · ${new Date().toLocaleString()} -->\n\n${body}`);
        toast(message);
    };
    return (React.createElement("div", { className: "screen" },
        React.createElement("div", { className: "editor-bar" },
            React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 4 } },
                React.createElement("button", { type: "button", className: "icon-btn", "aria-label": "\u8FD4\u56DE", onClick: onBack },
                    React.createElement(Icon, { name: "back", size: 22 })),
                React.createElement("div", { style: { flex: 1, fontSize: 16.5, fontWeight: 620, letterSpacing: '-0.01em', padding: '6px 2px' } }, "\u8BBE\u7F6E"))),
        React.createElement("div", { className: "no-scrollbar", style: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 16px calc(var(--safe-bottom) + 36px)' } },
            React.createElement("div", { className: "section-label", style: { padding: '6px 4px 9px' } }, "\u5916\u89C2"),
            React.createElement("div", { className: "setting-card", style: { marginBottom: 22 } },
                React.createElement("div", { className: "setting-row" },
                    React.createElement("span", { style: { fontSize: 14.5 } }, "\u4E3B\u9898"),
                    React.createElement("div", { className: "choice-group" }, THEMES.map((item) => (React.createElement("button", { key: item.key, type: "button", className: `choice${settings.theme === item.key ? ' is-active' : ''}`, onClick: () => updateSettings({ theme: item.key }) }, item.label))))),
                React.createElement("div", { className: "setting-row" },
                    React.createElement("span", { style: { fontSize: 14.5 } }, "\u6B63\u6587\u5B57\u4F53"),
                    React.createElement("div", { className: "choice-group" }, FONTS.map((item) => (React.createElement("button", { key: item.key, type: "button", className: `choice${settings.fontFamily === item.key ? ' is-active' : ''}`, onClick: () => updateSettings({ fontFamily: item.key }) }, item.label))))),
                React.createElement("div", { className: "setting-row" },
                    React.createElement("span", { style: { fontSize: 14.5 } }, "\u5B57\u53F7"),
                    React.createElement("div", { className: "stepper" },
                        React.createElement("button", { type: "button", className: "stepper-btn", "aria-label": "\u51CF\u5C0F\u5B57\u53F7", disabled: settings.fontSize <= 13, onClick: () => updateSettings({ fontSize: Math.max(13, settings.fontSize - 1) }) }, "\u2212"),
                        React.createElement("span", { className: "stepper-value" },
                            settings.fontSize,
                            "px"),
                        React.createElement("button", { type: "button", className: "stepper-btn", "aria-label": "\u589E\u5927\u5B57\u53F7", disabled: settings.fontSize >= 22, onClick: () => updateSettings({ fontSize: Math.min(22, settings.fontSize + 1) }) }, "+"))),
                React.createElement("div", { className: "setting-row" },
                    React.createElement("span", { style: { fontSize: 14.5 } }, "\u884C\u9AD8"),
                    React.createElement("div", { className: "stepper" },
                        React.createElement("button", { type: "button", className: "stepper-btn", "aria-label": "\u51CF\u5C0F\u884C\u9AD8", disabled: settings.lineHeight <= 1.5, onClick: () => updateSettings({ lineHeight: Math.round((settings.lineHeight - 0.05) * 100) / 100 }) }, "\u2212"),
                        React.createElement("span", { className: "stepper-value" }, settings.lineHeight.toFixed(2)),
                        React.createElement("button", { type: "button", className: "stepper-btn", "aria-label": "\u589E\u5927\u884C\u9AD8", disabled: settings.lineHeight >= 2.2, onClick: () => updateSettings({ lineHeight: Math.round((settings.lineHeight + 0.05) * 100) / 100 }) }, "+"))),
                React.createElement("div", { className: "setting-row" },
                    React.createElement("span", { style: { fontSize: 14.5 } }, "\u9875\u8FB9\u8DDD"),
                    React.createElement("div", { className: "choice-group" }, MARGINS.map((item) => (React.createElement("button", { key: item.key, type: "button", className: `choice${settings.margin === item.key ? ' is-active' : ''}`, onClick: () => updateSettings({ margin: item.key }) }, item.label)))))),
            React.createElement("div", { className: "section-label", style: { padding: '6px 4px 9px' } }, "\u7F16\u8F91"),
            React.createElement("div", { className: "setting-card", style: { marginBottom: 22 } },
                React.createElement("div", { className: "setting-row" },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 14.5 } }, "\u8BED\u6CD5\u9AD8\u4EAE"),
                        React.createElement("div", { style: { marginTop: 3, fontSize: 12, color: 'var(--faint)' } }, "\u7F16\u8F91\u65F6\u7ED9\u6807\u8BB0\u4E0A\u8272")),
                    React.createElement("button", { type: "button", className: `switch${settings.highlight ? ' is-on' : ''}`, role: "switch", "aria-checked": settings.highlight, onClick: () => updateSettings({ highlight: !settings.highlight }) },
                        React.createElement("span", { className: "switch-knob" })))),
            React.createElement("div", { className: "section-label", style: { padding: '6px 4px 9px' } }, "\u6570\u636E"),
            React.createElement("div", { className: "setting-card", style: { marginBottom: 22 } },
                React.createElement("button", { type: "button", className: "setting-row", style: { width: '100%' }, onClick: importNow },
                    React.createElement("span", { style: { fontSize: 14.5 } }, "\u5BFC\u5165\u6587\u4EF6\uFF08.md / .txt\uFF09"),
                    React.createElement(Icon, { name: "upload", size: 18 })),
                React.createElement("button", { type: "button", className: "setting-row", style: { width: '100%' }, onClick: importFolderNow },
                    React.createElement("span", { style: { fontSize: 14.5 } }, "\u5BFC\u5165\u6587\u4EF6\u5939"),
                    React.createElement(Icon, { name: "folder", size: 18 })),
                React.createElement("button", { type: "button", className: "setting-row", style: { width: '100%' }, onClick: exportAll },
                    React.createElement("span", { style: { fontSize: 14.5 } }, "\u5BFC\u51FA\u5168\u90E8\uFF08.md\uFF09"),
                    React.createElement(Icon, { name: "download", size: 18 }))),
            React.createElement("div", { className: "setting-card" },
                React.createElement("div", { className: "setting-row" },
                    React.createElement("span", { style: { fontSize: 14.5 } }, "\u6587\u6863\u6570\u91CF"),
                    React.createElement("span", { style: { fontSize: 13.5, color: 'var(--muted)' } },
                        docs.length,
                        " \u7BC7")),
                React.createElement("div", { className: "setting-row" },
                    React.createElement("span", { style: { fontSize: 14.5 } }, "\u5B58\u50A8\u65B9\u5F0F"),
                    React.createElement("span", { style: { fontSize: 13.5, color: 'var(--muted)' } }, isNative() ? '设备本地' : '浏览器本地')),
                React.createElement("div", { className: "setting-row" },
                    React.createElement("span", { style: { fontSize: 14.5 } }, "\u7248\u672C"),
                    React.createElement("span", { style: { fontSize: 13.5, color: 'var(--muted)' } }, "1.1.0"))),
            React.createElement("div", { style: { marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--faint)', lineHeight: 1.7 } },
                "MarkPad \u00B7 \u7EAF\u672C\u5730 Markdown \u5199\u4F5C",
                React.createElement("br", null),
                "\u6240\u6709\u5185\u5BB9\u53EA\u5B58\u5728\u8FD9\u53F0\u8BBE\u5907\u4E0A"))));
}
