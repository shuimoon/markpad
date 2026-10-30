/* Assert the packaged APK carries the freshly built web assets. */
import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'

const apk = readFileSync(process.argv[2] || 'dist/MarkPad-1.1.0.apk')

/** Minimal zip reader: find a stored/deflated entry by name and return its text. */
function readEntry(buffer, wanted) {
  let offset = 0
  while (offset + 30 < buffer.length) {
    const sig = buffer.readUInt32LE(offset)
    if (sig !== 0x04034b50) break
    const method = buffer.readUInt16LE(offset + 8)
    const compressed = buffer.readUInt32LE(offset + 18)
    const nameLen = buffer.readUInt16LE(offset + 26)
    const extraLen = buffer.readUInt16LE(offset + 28)
    const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLen)
    const dataStart = offset + 30 + nameLen + extraLen
    if (name === wanted) {
      const raw = buffer.subarray(dataStart, dataStart + compressed)
      return (method === 0 ? raw : inflateRawSync(raw)).toString('utf8')
    }
    offset = dataStart + compressed
  }
  return null
}

const checks = [
  ['assets/www/js/lib/importers.js', ['awaitPickedFiles', "addEventListener('cancel'"]],
  ['assets/www/js/screens/Settings.js', ['importFolderNow', 'pickMarkdownFolder']],
  ['assets/www/js/lib/platform.ts', []],
  ['assets/www/styles.css', ['rgba(12, 26, 21']],
  ['assets/www/js/screens/Library.js', ['onDrop', 'drop-veil']],
]

let bad = 0
console.log(`apk ${apk.length} bytes`)
for (const [name, needles] of checks) {
  if (name.endsWith('.ts')) continue
  const text = readEntry(apk, name)
  if (text == null) {
    console.log(`MISSING ${name}`)
    bad++
    continue
  }
  const results = needles.map((needle) => `${needle}=${text.includes(needle)}`)
  console.log(`${name} (${text.length} chars) ${results.join(' ')}`)
  if (results.some((item) => item.endsWith('=false'))) bad++
}
console.log(bad === 0 ? 'apk assets OK' : `apk assets BAD (${bad})`)
process.exit(bad === 0 ? 0 : 1)
