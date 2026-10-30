import React, { useEffect } from '../../vendor/react.shim.js';
import { createPortal } from '../../vendor/react-dom.shim.js';
import { Icon } from './Icon.js';
const closeStack = [];
/** Used by the Android back button: closes the top-most sheet, returns true if it did. */
export function closeTopSheet() {
    const top = closeStack[closeStack.length - 1];
    if (!top)
        return false;
    top();
    return true;
}
export function Sheet({ open, onClose, title, children, }) {
    useEffect(() => {
        if (!open)
            return;
        const onKey = (event) => {
            if (event.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        closeStack.push(onClose);
        return () => {
            window.removeEventListener('keydown', onKey);
            const index = closeStack.lastIndexOf(onClose);
            if (index >= 0)
                closeStack.splice(index, 1);
        };
    }, [open, onClose]);
    if (!open)
        return null;
    return createPortal(React.createElement(React.Fragment, null,
        React.createElement("div", { className: "scrim", onPointerDown: onClose }),
        React.createElement("div", { className: "sheet-panel animate-sheet-up", role: "dialog", "aria-modal": "true" },
            React.createElement("div", { className: "sheet-grabber" }),
            title ? (React.createElement("div", { className: "section-label", style: { padding: '4px 12px 8px' } }, title)) : null,
            children)), document.body);
}
export function SheetRow({ icon, label, onClick, danger, trailing, }) {
    return (React.createElement("button", { type: "button", className: `sheet-row${danger ? ' is-danger' : ''}`, onClick: onClick },
        icon ? React.createElement(Icon, { name: icon, size: 19 }) : null,
        React.createElement("span", { style: { flex: 1 } }, label),
        trailing));
}
export function Toast({ text }) {
    if (!text)
        return null;
    return createPortal(React.createElement("div", { className: "toast" }, text), document.body);
}
export function ConfirmSheet({ open, title, message, confirmLabel, onConfirm, onClose, }) {
    return (React.createElement(Sheet, { open: open, onClose: onClose },
        React.createElement("div", { style: { padding: '6px 14px 4px' } },
            React.createElement("div", { style: { fontSize: 17, fontWeight: 650, letterSpacing: '-0.01em' } }, title),
            message ? (React.createElement("div", { style: { marginTop: 6, fontSize: 13.5, lineHeight: 1.55, color: 'var(--muted)' } }, message)) : null),
        React.createElement("div", { style: { marginTop: 10 } },
            React.createElement(SheetRow, { label: confirmLabel, danger: true, onClick: () => {
                    onConfirm();
                    onClose();
                } }),
            React.createElement(SheetRow, { label: "\u53D6\u6D88", onClick: onClose }))));
}
