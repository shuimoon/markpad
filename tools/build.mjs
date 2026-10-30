import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const www = join(root, 'www')

mkdirSync(join(www, 'vendor'), { recursive: true })
mkdirSync(join(www, 'js'), { recursive: true })

/* 1. styles: strip Vite/Tailwind directives and add app-specific fixes */
const raw = readFileSync(join(root, 'src', 'index.css'), 'utf8')
const stripped = raw
  .split('\n')
  .filter((line) => !/^\s*@tailwind\s/.test(line))
  .join('\n')

const extra = `
/* ------------------------------------------------------------------ */
/* Runtime fixes (added by tools/build.mjs)                            */
/* ------------------------------------------------------------------ */

*,
*::before,
*::after {
  box-sizing: border-box;
}

.editor-input::-webkit-scrollbar,
.editor-overlay::-webkit-scrollbar {
  width: 0;
  height: 0;
}
.editor-input,
.editor-overlay {
  scrollbar-width: none;
  -ms-overflow-style: none;
  box-sizing: border-box;
}
.editor-input {
  overscroll-behavior: contain;
  tab-size: 2;
}

.md-body .task-item {
  list-style: none;
}
.md-body .task-box {
  padding: 0;
  margin: 0;
  background: transparent;
  color: #fff;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.md-body .task-text {
  flex: 1;
  min-width: 0;
}

.toolbar {
  scrollbar-width: none;
}
.toolbar::-webkit-scrollbar {
  display: none;
}

.reader,
.split-pane .editor-overlay {
  overscroll-behavior: contain;
}

button {
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
}

input[type='search']::-webkit-search-decoration,
input[type='search']::-webkit-search-cancel-button {
  -webkit-appearance: none;
  display: none;
}
`

writeFileSync(join(www, 'styles.css'), `${stripped}\n${extra}`, 'utf8')

/* 2. React UMD builds */
copyFileSync(
  join(root, 'node_modules', 'react', 'umd', 'react.production.min.js'),
  join(www, 'vendor', 'react.js')
)
copyFileSync(
  join(root, 'node_modules', 'react-dom', 'umd', 'react-dom.production.min.js'),
  join(www, 'vendor', 'react-dom.js')
)

/* 3. keep the web entry next to the compiled bundle */
const entry = readFileSync(join(www, 'index.html'), 'utf8')
if (!entry.includes('./js/main.js')) {
  throw new Error('www/index.html is missing the bundle entry')
}

console.log('[build] styles.css + vendor react copied')
