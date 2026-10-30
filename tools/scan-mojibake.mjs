/* Detect text that went through a UTF-8 -> GBK -> UTF-8 round trip (mojibake).
 * Heuristics that catch what a corrupted project looks like:
 *   - U+FFFD replacement characters
 *   - '?' sitting directly next to a CJK char (a byte was destroyed)
 *   - dense runs of the junk characters this specific corruption produces
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SKIP = /(node_modules|\\build\\|\.smoke|\.shots|\.git|www\\js|\.npm-cache)/
const EXT = /\.(ts|tsx|js|mjs|cjs|java|xml|css|html|json|md|ps1|py|txt)$/

const JUNK = /[\u9225\u951b\u9286\u93c2\u7487\u59dd\u9563\u94e8\u6d93\u20ac\ufffd]/
const CJK_Q = /[\u4e00-\u9fff]\?|\?[\u4e00-\u9fff]/

const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (SKIP.test(full)) continue
    const st = statSync(full)
    if (st.isDirectory()) walk(full)
    else if (EXT.test(name)) files.push(full)
  }
}
walk(ROOT)

let hits = 0
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  lines.forEach((line, index) => {
    if (!JUNK.test(line) && !CJK_Q.test(line)) return
    hits++
    console.log(`${relative(ROOT, file)}:${index + 1}: ${line.trim().slice(0, 110)}`)
  })
}
console.log(`\nfiles scanned: ${files.length}, suspicious lines: ${hits}`)
