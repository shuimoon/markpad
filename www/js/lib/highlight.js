import { escapeHtml } from './format.js';
const PUNCT = '\\`*_{}[]()#+-.!~>|';
function push(toks, t, c = '') {
    if (!t)
        return;
    toks.push({ t, c });
}
/** Tokenize one markdown line for the editor's syntax-coloured overlay. */
function tokenizeLine(line) {
    const toks = [];
    const heading = line.match(/^(\s{0,3})(#{1,6})(\s+)(.*)$/);
    if (heading) {
        push(toks, heading[1]);
        push(toks, heading[2], 'tok-head');
        push(toks, heading[3]);
        toks.push(...inline(heading[4]));
        return toks;
    }
    const quote = line.match(/^(\s{0,3})(>)(\s?)(.*)$/);
    if (quote) {
        push(toks, quote[1]);
        push(toks, quote[2], 'tok-quote');
        push(toks, quote[3]);
        toks.push(...inline(quote[4]));
        return toks;
    }
    const list = line.match(/^(\s*)([-*+]|\d{1,9}[.)])(\s+)(.*)$/);
    if (list) {
        push(toks, list[1]);
        push(toks, list[2], 'tok-list');
        push(toks, list[3]);
        const task = list[4].match(/^(\[[ xX]\])(\s+)(.*)$/);
        if (task) {
            push(toks, task[1], 'tok-marker');
            push(toks, task[2]);
            toks.push(...inline(task[3]));
            return toks;
        }
        toks.push(...inline(list[4]));
        return toks;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        push(toks, line, 'tok-marker');
        return toks;
    }
    return inline(line);
}
function inline(src) {
    const toks = [];
    let buf = '';
    let i = 0;
    const flush = () => {
        if (buf) {
            push(toks, buf);
            buf = '';
        }
    };
    while (i < src.length) {
        const ch = src[i];
        if (ch === '\\' && i + 1 < src.length && PUNCT.indexOf(src[i + 1]) >= 0) {
            buf += src.slice(i, i + 2);
            i += 2;
            continue;
        }
        if (ch === '`') {
            const close = src.indexOf('`', i + 1);
            if (close > i + 1) {
                flush();
                push(toks, src.slice(i, close + 1), 'tok-code');
                i = close + 1;
                continue;
            }
        }
        if (ch === '*' && src[i + 1] === '*') {
            const close = src.indexOf('**', i + 2);
            if (close > i + 2) {
                flush();
                push(toks, src.slice(i, close + 2), 'tok-strong');
                i = close + 2;
                continue;
            }
        }
        if (ch === '~' && src[i + 1] === '~') {
            const close = src.indexOf('~~', i + 2);
            if (close > i + 2) {
                flush();
                push(toks, src.slice(i, close + 2), 'tok-marker');
                i = close + 2;
                continue;
            }
        }
        if (ch === '*' || ch === '_') {
            let close = -1;
            for (let j = i + 1; j < src.length; j++) {
                if (src[j] === ch) {
                    close = j;
                    break;
                }
            }
            if (close > i + 1) {
                flush();
                push(toks, src.slice(i, close + 1), 'tok-em');
                i = close + 1;
                continue;
            }
        }
        if ((ch === '[' || (ch === '!' && src[i + 1] === '[')) && src.indexOf('](', i) > 0) {
            const start = ch === '!' ? i : i;
            const bracket = ch === '!' ? i + 1 : i;
            const closeBracket = src.indexOf('](', bracket);
            const closeParen = closeBracket >= 0 ? src.indexOf(')', closeBracket + 2) : -1;
            if (closeBracket > 0 && closeParen > 0) {
                flush();
                if (ch === '!')
                    push(toks, '!', 'tok-marker');
                push(toks, src.slice(bracket, closeBracket + 1), 'tok-link');
                push(toks, src.slice(closeBracket + 1, closeParen + 1), 'tok-marker');
                i = closeParen + 1;
                continue;
            }
            void start;
        }
        buf += ch;
        i += 1;
    }
    flush();
    return toks;
}
export function highlightMarkdown(src) {
    const lines = src.replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let fence = null;
    for (const line of lines) {
        const open = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
        if (fence) {
            if (new RegExp(`^\\s{0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}\\s*$`).test(line)) {
                out.push(render([{ t: line, c: 'tok-marker' }]));
                fence = null;
            }
            else {
                out.push(render([{ t: line, c: 'tok-fence' }]));
            }
            continue;
        }
        if (open) {
            out.push(render([{ t: open[1], c: 'tok-marker' }, { t: open[2], c: 'tok-head' }]));
            fence = open[1].trim();
            continue;
        }
        out.push(render(tokenizeLine(line)));
    }
    return out.join('\n');
}
function render(toks) {
    let html = '';
    for (const tok of toks) {
        const safe = escapeHtml(tok.t);
        html += tok.c ? `<span class="${tok.c}">${safe}</span>` : safe;
    }
    return html;
}
