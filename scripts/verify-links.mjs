// Spot-check: for a sample of resolved citations, refetch the manifest and confirm
// the canvas at the index we link to really carries the cited folio.
import { readFile } from 'node:fs/promises'
import { canvasLabel, folioKeys, manifestCanvases } from './iiif-folio.mjs'

const R = new URL('../', import.meta.url).pathname
const subjects = JSON.parse(await readFile(R + 'public/data/subjects.json', 'utf8'))
const iiif = JSON.parse(await readFile(R + 'public/data/iiif.json', 'utf8'))

const samples = []
const seenMs = new Set()
for (const s of subjects) {
  for (const r of s.references) {
    const e = iiif[r.manuscriptId]
    if (!e || seenMs.has(r.manuscriptId)) continue
    for (const f of r.folios) {
      const key = folioKeys(f.folio).find((k) => k in e.folios)
      if (!key) continue
      const [mi, cv] = e.folios[key]
      samples.push({ ms: r.manuscriptId, folio: f.folio, key, cv, manifest: e.manifests[mi].url, provider: e.manifests[mi].provider })
      seenMs.add(r.manuscriptId)
      break
    }
    if (seenMs.has(r.manuscriptId)) break
  }
  if (samples.length >= 22) break
}

let pass = 0
for (const s of samples) {
  try {
    const doc = await (await fetch(s.manifest, { headers: { accept: 'application/json' } })).json()
    const label = canvasLabel(manifestCanvases(doc)[s.cv])
    const norm = String(label || '').toLowerCase().replace(/\s+/g, '')
    const want = s.key.replace(/\s+/g, '')
    const ok = norm.includes(want) || norm.includes(want.replace(/r$/, ''))
    if (ok) pass++
    console.log(`${ok ? 'OK  ' : 'BAD '} ${s.ms.padEnd(20)} cited f.${s.folio.padEnd(10)} -> cv=${String(s.cv).padEnd(4)} label="${label}"  [${s.provider}]`)
  } catch (e) {
    console.log(`SKIP ${s.ms.padEnd(20)} ${e.message}`)
  }
}
console.log(`\n${pass}/${samples.length} landed on a canvas whose label contains the cited folio`)
