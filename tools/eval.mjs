/* Debug helper: evaluate an expression in the page Chrome is already showing.
 * Usage: node tools/eval.mjs "expression"
 */
const PORT = Number(process.env.CDP_PORT || 9333)
const arg = process.argv[2]
const expression = arg && arg.startsWith('@') ? (await import('node:fs')).readFileSync(arg.slice(1), 'utf8') : arg

const pages = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = pages.find((t) => t.type === 'page')
if (!page) throw new Error('no page target')

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((ok, bad) => {
  ws.addEventListener('open', ok, { once: true })
  ws.addEventListener('error', () => bad(new Error('ws error')), { once: true })
})

let id = 0
const pending = new Map()
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { ok, bad } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) bad(new Error(msg.error.message))
    else ok(msg.result)
  }
})

function send(method, params = {}) {
  const next = ++id
  return new Promise((ok, bad) => {
    pending.set(next, { ok, bad })
    ws.send(JSON.stringify({ id: next, method, params }))
    setTimeout(() => {
      if (pending.has(next)) {
        pending.delete(next)
        bad(new Error('timeout: ' + method))
      }
    }, 15000)
  })
}

await send('Runtime.enable')
const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
if (res.exceptionDetails) {
  console.log('EXCEPTION:', res.exceptionDetails.exception?.description || res.exceptionDetails.text)
} else {
  console.log(JSON.stringify(res.result.value, null, 2))
}
ws.close()
