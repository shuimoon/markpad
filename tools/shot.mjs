/* Screenshot driver: talks CDP to a headless Chrome already running with
 * --remote-debugging-port. Usage: node tools/shot.mjs [outDir]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const PORT = Number(process.env.CDP_PORT || 9333)
const OUT = resolve(process.argv[2] || '.shots')
const BASE = process.env.APP_URL || 'http://127.0.0.1:5173/'
const WIDTH = 390
const HEIGHT = 844
const DPR = 2

mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function listTarget() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const pages = (await res.json()).filter((t) => t.type === 'page')
      if (pages.length) return pages[0]
    } catch {
      /* not up yet */
    }
    await sleep(250)
  }
  throw new Error('no CDP page target found')
}

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: ok, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message))
        else ok(msg.result)
      }
    })
  }

  send(method, params = {}) {
    const id = ++this.id
    return new Promise((ok, reject) => {
      this.pending.set(id, { resolve: ok, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`timeout: ${method}`))
        }
      }, 20000)
    })
  }
}

const target = await listTarget()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((ok, bad) => {
  ws.addEventListener('open', ok, { once: true })
  ws.addEventListener('error', () => bad(new Error('ws error')), { once: true })
})
const cdp = new Cdp(ws)

const problems = []
ws.addEventListener('message', (ev) => {
  let msg
  try {
    msg = JSON.parse(ev.data)
  } catch {
    return
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params?.exceptionDetails
    problems.push('exception: ' + (d?.exception?.description || d?.text || 'unknown'))
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
    problems.push(
      'console.error: ' + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')
    )
  }
  if (msg.method === 'Log.entryAdded' && msg.params?.entry?.level === 'error') {
    problems.push('log: ' + msg.params.entry.text)
  }
})

await cdp.send('Log.enable')
await cdp.send('Page.enable')
await cdp.send('Runtime.enable')
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: WIDTH,
  height: HEIGHT,
  deviceScaleFactor: DPR,
  mobile: true,
})

async function evaluate(expression) {
  const res = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description || 'eval failed')
  }
  return res.result.value
}

async function goto(url) {
  await cdp.send('Page.navigate', { url })
  await sleep(900)
}

async function shot(name) {
  await sleep(350)
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  })
  const file = join(OUT, `${name}.png`)
  writeFileSync(file, Buffer.from(data, 'base64'))
  console.log('shot', name, Buffer.from(data, 'base64').length, 'bytes')
}

const clickByText = (text, selector = 'button') => `(() => {
  const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})]
  const hit = nodes.find((n) => (n.textContent || '').trim().includes(${JSON.stringify(text)}))
  if (!hit) return 'miss'
  hit.click()
  return 'ok'
})()`

const clickByLabel = (label) => `(() => {
  const hit = document.querySelector('[aria-label=' + JSON.stringify(${JSON.stringify(
    label
  )}) + ']')
  if (!hit) return 'miss'
  hit.click()
  return 'ok'
})()`

await goto(BASE)
await evaluate(`localStorage.clear(); location.hash = '#/';`)
await sleep(600)
await cdp.send('Page.reload', {})
await sleep(1200)
await shot('01-library')

console.log('docs:', await evaluate(`document.querySelectorAll('.doc-card').length`))
console.log('click card:', await evaluate(clickByText('欢迎使用', '.doc-card')))
await sleep(700)
await shot('02-editor-split')

console.log('click 预览:', await evaluate(clickByText('预览', '.segmented-item')))
await sleep(700)
await shot('03-reader')

console.log('click 编辑:', await evaluate(clickByText('编辑', '.segmented-item')))
await sleep(600)
await shot('04-editor')

console.log(
  'editor metrics:',
  JSON.stringify(
    await evaluate(`(() => {
      const ta = document.querySelector('.editor-input')
      const ov = document.querySelector('.editor-overlay')
      if (!ta || !ov) return { missing: true }
      const inner = ov.firstElementChild
      return {
        taClient: ta.clientHeight,
        taScroll: ta.scrollHeight,
        ovClient: ov.clientHeight,
        innerHeight: inner ? Math.round(inner.getBoundingClientRect().height) : null,
        taPad: getComputedStyle(ta).padding,
        ovPad: getComputedStyle(ov).padding,
        taFont: getComputedStyle(ta).fontSize + '/' + getComputedStyle(ta).lineHeight,
        ovFont: getComputedStyle(inner || ov).fontSize + '/' + getComputedStyle(inner || ov).lineHeight,
      }
    })()`)
  )
)

console.log(
  'focus editor:',
  await evaluate(
    `(() => { const ta = document.querySelector('.editor-input'); if (!ta) return 'miss'; ta.focus(); ta.setSelectionRange(0, 0); return 'ok' })()`
  )
)
await cdp.send('Input.insertText', { text: '新增一段测试文字。\n\n' })
await sleep(700)
console.log(
  'after typing:',
  JSON.stringify(
    await evaluate(`(() => ({
      stored: (JSON.parse(localStorage.getItem('markpad.docs.v1') || '[]')[0] || {}).content?.slice(0, 20),
      status: document.querySelector('.editor-status')?.textContent,
      overlayFirst: document.querySelector('.editor-overlay .mp-editor-text')?.textContent?.slice(0, 20),
    }))()`)
  )
)
await shot('04b-editor-typed')
console.log('toolbar keys:', await evaluate(`document.querySelectorAll('.tool-key').length`))

console.log('open menu:', await evaluate(clickByLabel('更多')))
await sleep(600)
await shot('05-menu')
await evaluate(`(() => { const s = document.querySelector('.scrim'); if (s) s.click(); return 'ok' })()`)
await sleep(400)

console.log('outline:', await evaluate(clickByLabel('更多')))
await sleep(400)
console.log('outline row:', await evaluate(clickByText('大纲', '.sheet-row')))
await sleep(700)
await shot('06-outline')
await evaluate(`(() => { const s = document.querySelector('.scrim'); if (s) s.click(); return 'ok' })()`)
await sleep(400)

console.log('back:', await evaluate(clickByLabel('返回')))
await sleep(900)
console.log('go settings:', await evaluate(clickByLabel('设置')))
await sleep(800)
await shot('07-settings')

console.log('dark theme:', await evaluate(clickByText('深色', '.choice')))
await sleep(700)
await shot('08-settings-dark')
await evaluate(`history.back()`)
await sleep(900)
await shot('09-library-dark')

console.log('sepia theme:', await evaluate(clickByLabel('设置')))
await sleep(700)
await evaluate(clickByText('护眼', '.choice'))
await sleep(500)
await evaluate(`history.back()`)
await sleep(900)
await shot('10-library-sepia')

console.log('search:', await evaluate(clickByLabel('设置')))
await sleep(500)
await evaluate(clickByText('浅色', '.choice'))
await sleep(400)
await evaluate(`history.back()`)
await sleep(800)
console.log(
  'search focus:',
  await evaluate(`(() => { const i = document.querySelector('.search-input'); if (!i) return 'miss'; i.focus(); return 'ok' })()`)
)
await cdp.send('Input.insertText', { text: 'markdown' })
await sleep(800)
console.log(
  'search hits:',
  JSON.stringify(
    await evaluate(`(() => ({
      cards: document.querySelectorAll('.doc-card').length,
      marks: document.querySelectorAll('.mark').length,
      query: document.querySelector('.search-input')?.value,
    }))()`)
  )
)
await shot('11-search')

/* ---------- drag & drop import ---------- */
await evaluate(`(() => {
  const input = document.querySelector('.search-input')
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, '')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return 'cleared'
})()`)
await sleep(500)

const dropScript = (files) => `(() => {
  const card = document.querySelector('.doc-card') || document.querySelector('.screen')
  if (!card) return 'miss'
  const dt = new DataTransfer()
  ${files}
  for (const type of ['dragenter', 'dragover']) {
    card.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }))
  }
  const veil = !!document.querySelector('.drop-veil')
  card.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
  return 'dropped, veil shown: ' + veil
})()`

console.log(
  'drop markdown:',
  await evaluate(
    dropScript(
      `dt.items.add(new File(['# 拖进来的笔记\\n\\n这是拖拽导入的正文。'], '拖拽测试.md', { type: 'text/markdown' }))
       dt.items.add(new File(['not markdown'], 'photo.png', { type: 'image/png' }))`
    )
  )
)
await sleep(1000)
console.log(
  'after drop:',
  JSON.stringify(
    await evaluate(`(() => ({
      cards: document.querySelectorAll('.doc-card').length,
      first: document.querySelector('.doc-title')?.textContent,
      toast: document.querySelector('.toast')?.textContent || null,
      stored: (JSON.parse(localStorage.getItem('markpad.docs.v1') || '[]')).length,
    }))()`)
  )
)
await shot('12-imported')

console.log(
  'drop same file again:',
  await evaluate(
    dropScript(
      `dt.items.add(new File(['# 拖进来的笔记\\n\\n这是拖拽导入的正文。'], '拖拽测试.md', { type: 'text/markdown' }))`
    )
  )
)
await sleep(900)
console.log(
  'after duplicate drop:',
  JSON.stringify(
    await evaluate(`(() => ({
      cards: document.querySelectorAll('.doc-card').length,
      toast: document.querySelector('.toast')?.textContent || null,
    }))()`)
  )
)

console.log('settings data rows:', await evaluate(clickByLabel('设置')))
await sleep(800)
await evaluate(`(() => { const s = document.querySelectorAll('.no-scrollbar'); const last = s[s.length - 1]; if (last) last.scrollTop = last.scrollHeight; return 'ok' })()`)
await sleep(500)
console.log(
  'data card text:',
  JSON.stringify(await evaluate(`document.querySelectorAll('.setting-card')[2]?.textContent`))
)
await shot('13-settings-data')

/* ---------- folder import through the native bridge ---------- */
console.log(
  'native folder import:',
  JSON.stringify(
    await evaluate(`(() => {
      const payload = JSON.stringify({
        files: [
          { name: '笔记A.md', path: '子目录/笔记A.md', content: '# 笔记A\\n\\n来自文件夹的内容。' },
          { name: 'b.txt', path: 'b.txt', content: '纯文本内容,没有标题。' },
          { name: 'index.md', path: 'index.md', content: '# 文件夹索引\\n\\n这个标题应该被用上。' },
        ],
        truncated: false,
      })
      window.MarkPad = {
        pickFolder() { setTimeout(() => window.__markpadFolder && window.__markpadFolder(payload), 120) },
        saveFile: () => 'stub',
        shareFile: () => 'stub',
      }
      const rows = [...document.querySelectorAll('.setting-card button.setting-row')]
      const row = rows.find((item) => item.textContent.includes('导入文件夹'))
      row.click()
      return 'clicked'
    })()`)
  )
)
await sleep(1000)
console.log(
  'after folder import:',
  JSON.stringify(
    await evaluate(`(() => {
      const docs = JSON.parse(localStorage.getItem('markpad.docs.v1') || '[]')
      const out = {
        total: docs.length,
        toast: document.querySelector('.toast')?.textContent || null,
        titles: docs.slice(0, 3).map((d) => d.title),
        storageLabel: [...document.querySelectorAll('.setting-card')].pop()?.textContent?.includes('设备本地'),
        handlerCleared: typeof window.__markpadFolder,
      }
      delete window.MarkPad
      return out
    })()`)
  )
)
await evaluate(`history.back()`)
await sleep(900)
await shot('14-folder-import')


console.log('hw back at library:', await evaluate(`String(window.__markpadBack())`))
console.log('open sheet for back test:', await evaluate(clickByLabel('设置')))
await sleep(600)
console.log('hw back at settings:', await evaluate(`String(window.__markpadBack())`), await evaluate(`location.hash`))
console.log('hw back at doc:', await evaluate(clickByText('欢迎使用', '.doc-card')))
await sleep(700)
console.log('  sheet-less back:', await evaluate(`String(window.__markpadBack())`), await evaluate(`location.hash`))
await sleep(600)

/* ---------- drag veil, then the empty library ---------- */
console.log(
  'drag veil:',
  await evaluate(`(() => {
    const card = document.querySelector('.doc-card')
    const dt = new DataTransfer()
    dt.items.add(new File(['# x'], 'x.md', { type: 'text/markdown' }))
    card.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }))
    return 'entered'
  })()`)
)
await sleep(400)
console.log('veil visible:', await evaluate(`!!document.querySelector('.drop-veil')`))
await shot('15-drag-veil')
await evaluate(`(() => {
  const card = document.querySelector('.doc-card')
  card.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true }))
  return 'left'
})()`)
await sleep(300)

console.log(
  'empty library:',
  await evaluate(`(() => {
    localStorage.setItem('markpad.docs.v1', '[]')
    localStorage.setItem('markpad.seeded.v1', '1')
    location.reload()
    return 'reloading'
  })()`)
)
await sleep(1600)
console.log(
  'empty state:',
  JSON.stringify(
    await evaluate(`(() => ({
      cards: document.querySelectorAll('.doc-card').length,
      empty: !!document.querySelector('.empty-state'),
      action: document.querySelector('.empty-action')?.textContent || null,
    }))()`)
  )
)
await shot('16-empty')

console.log('problems:', problems.length ? JSON.stringify(problems.slice(0, 6)) : 'none')
ws.close()
console.log('done')
