// Fetches every IIIF manifest named in database/digitized.json and records which
// folios map to which canvas index. Browsers cannot do this at runtime: none of
// these providers send CORS headers. Result is cached in database/iiif_index.json;
// re-running only refetches manifests that are missing or errored.
import { readFile, writeFile } from 'node:fs/promises'
import { indexManifest } from './iiif-folio.mjs'

const ROOT = new URL('..', import.meta.url)
const OUT = new URL('database/iiif_index.json', ROOT)
const CONCURRENCY = Number(process.env.IIIF_CONCURRENCY || 6)
const PAUSE_MS = Number(process.env.IIIF_PAUSE_MS || 0)
const RETRIES = Number(process.env.IIIF_RETRIES || 2)
const TIMEOUT_MS = 60000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const digitized = JSON.parse(await readFile(new URL('database/digitized.json', ROOT), 'utf8'))

let cache = {}
try {
  cache = JSON.parse(await readFile(OUT, 'utf8'))
} catch {}

const urls = []
for (const rec of digitized) {
  for (const r of rec.resources || []) {
    if (r.type === 'iiif_manifest' && !urls.includes(r.url)) urls.push(r.url)
  }
}

const force = process.argv.includes('--force')
const todo = urls.filter((u) => force || !cache[u] || cache[u].error)
console.log(`${urls.length} manifests total, ${todo.length} to fetch`)

let done = 0
async function fetchOnce(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: 'application/json,application/ld+json;q=0.9,*/*;q=0.8', 'user-agent': 'marginalia-db/1.0' },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const doc = JSON.parse(await res.text())
    return { ...indexManifest(doc), fetched: new Date().toISOString().slice(0, 10) }
  } finally {
    clearTimeout(timer)
  }
}

async function fetchOne(url) {
  let last
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt) await sleep(2000 * 2 ** attempt)
    try {
      cache[url] = await fetchOnce(url)
      last = null
      break
    } catch (err) {
      last = err
    }
  }
  if (last) cache[url] = { error: String(last.message || last), fetched: new Date().toISOString().slice(0, 10) }
  if (PAUSE_MS) await sleep(PAUSE_MS)
  done++
  if (done % 5 === 0) console.log(`  ${done}/${todo.length}`)
}

const queue = [...todo]
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await fetchOne(queue.shift())
  })
)

await writeFile(OUT, JSON.stringify(cache, null, 1))
const ok = urls.filter((u) => !cache[u]?.error)
const foliated = ok.filter((u) => cache[u]?.foliated)
console.log(`done: ${ok.length}/${urls.length} indexed, ${foliated.length} foliated`)
for (const u of urls) if (cache[u]?.error) console.log(`  FAIL ${cache[u].error}  ${u}`)
