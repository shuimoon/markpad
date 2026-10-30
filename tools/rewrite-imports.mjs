/* Rewrites bare module specifiers in the compiled output to the bundled vendor
 * shims, so the app runs on any ES-module capable WebView without relying on
 * an import map (older Android WebViews do not implement import maps).
 *
 * Usage: node tools/rewrite-imports.mjs   (run after tsc)
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = 'www'
const JS = join(ROOT, 'js')

const SHIMS = [
  ['react-dom/client', 'vendor/react-dom-client.shim.js'],
  ['react-dom', 'vendor/react-dom.shim.js'],
  ['react', 'vendor/react.shim.js'],
]

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.js')) out.push(full)
  }
  return out
}

let files = 0
let hits = 0

for (const file of walk(JS)) {
  const depth = relative(ROOT, file).split(sep).length - 1
  const prefix = depth > 0 ? '../'.repeat(depth) : './'
  const original = readFileSync(file, 'utf8')
  let next = original
  for (const [name, target] of SHIMS) {
    const pattern = new RegExp(`from\\s*(['"])${name.replace('/', '\\/')}\\1`, 'g')
    next = next.replace(pattern, (_match, quote) => {
      hits += 1
      return `from ${quote}${prefix}${target}${quote}`
    })
  }
  if (next !== original) {
    writeFileSync(file, next)
    files += 1
  }
}

console.log(`[imports] rewrote ${hits} specifier(s) in ${files} file(s)`)
