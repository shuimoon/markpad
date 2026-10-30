import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'www')
const port = Number(process.env.PORT || 5173)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
}

createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0])
  let path = join(root, normalize(url).replace(/^([/\\])+/, ''))
  if (!path.startsWith(root)) {
    res.writeHead(403).end('forbidden')
    return
  }
  try {
    const stat = statSync(path)
    if (stat.isDirectory()) path = join(path, 'index.html')
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found')
    return
  }
  const type = TYPES[extname(path).toLowerCase()] || 'application/octet-stream'
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' })
  createReadStream(path).pipe(res)
}).listen(port, '127.0.0.1', () => {
  console.log(`serving ${root} on http://127.0.0.1:${port}`)
})
