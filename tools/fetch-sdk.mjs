/* Downloads the Android command-line tools zip into ../android-sdk.
 * Usage: node tools/fetch-sdk.mjs [url]
 */
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const URL =
  process.argv[2] ||
  'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip'
const outDir = resolve('../android-sdk')
const outFile = resolve(outDir, 'cmdline-tools.zip')

mkdirSync(outDir, { recursive: true })

if (existsSync(outFile)) {
  const size = statSync(outFile).size
  if (size > 50 * 1024 * 1024) {
    console.log('already downloaded', size)
    process.exit(0)
  }
}

const res = await fetch(URL, { redirect: 'follow' })
if (!res.ok || !res.body) {
  console.error('download failed', res.status, res.statusText)
  process.exit(1)
}
const total = Number(res.headers.get('content-length') || 0)
console.log('downloading', Math.round(total / 1024 / 1024), 'MB')

const file = createWriteStream(outFile)
const reader = res.body.getReader()
let got = 0
let lastTick = 0
for (;;) {
  const { done, value } = await reader.read()
  if (done) break
  file.write(Buffer.from(value))
  got += value.length
  if (got - lastTick > 8 * 1024 * 1024) {
    lastTick = got
    console.log('  ...', Math.round(got / 1024 / 1024), 'MB')
  }
}
file.end()
await new Promise((r) => file.on('close', r))
console.log('saved', outFile, got)
