// Some libraries label canvases "Seq. 9" or "Page 204" — an image counter, not a
// folio. For a straightforwardly scanned book the two are related by
//
//     canvas = 2 * folio + (verso ? 1 : 0) + offset
//
// but the offset depends on how many covers and flyleaves were shot first, and
// nothing in the manifest states it. This fetches the upper corner of a canvas,
// where modern foliation is normally pencilled, so the offset can be read off a
// real leaf and checked at a second, distant leaf before being trusted.
//
//   node scripts/foliation-probe.mjs "BBR 9391" 8 322
//   node scripts/foliation-probe.mjs "W. 88" 60 --region 0.39,0.15,0.23,0.11
//
// The default region is the upper outer corner of a leaf that fills the frame.
// Scans that place a colour chart beside the leaf need a narrower region.
import { readFile, mkdir, writeFile } from 'node:fs/promises'

const ROOT = new URL('..', import.meta.url)
const read = async (p) => JSON.parse(await readFile(new URL(p, ROOT), 'utf8'))

const argv = process.argv.slice(2)
const widthArg = argv.indexOf('--width')
// A number, or "full" for the image's native resolution. Low-resolution scans
// are often only legible at native size: downscaling a page to fit the screen
// is what makes pencil and red-ink foliation vanish.
let WIDTH = 1000
if (widthArg !== -1) {
  WIDTH = argv[widthArg + 1] === 'full' ? 'full' : Number(argv[widthArg + 1])
  argv.splice(widthArg, 2)
}
const regionArg = argv.indexOf('--region')
let REGION = [0.6, 0, 0.4, 0.15]
if (regionArg !== -1) {
  REGION = argv[regionArg + 1].split(',').map(Number)
  argv.splice(regionArg, 2)
}
const [msId, ...canvasArgs] = argv
if (!msId) {
  console.error('usage: node scripts/foliation-probe.mjs "<manuscript id>" [canvasIndex ...]')
  process.exit(1)
}

const digitized = await read('database/digitized.json')
const rec = digitized.find((d) => d.manuscript_id === msId)
const manifestUrl = rec?.resources.find((r) => r.type === 'iiif_manifest')?.url
if (!manifestUrl) {
  console.error(`no IIIF manifest for ${msId}`)
  process.exit(1)
}

const doc = await (await fetch(manifestUrl, { headers: { accept: 'application/json' } })).json()
const canvases = doc.items ?? doc.sequences?.[0]?.canvases ?? []
const out = new URL(`.probe/${msId.replace(/[^\w.-]+/g, '_')}/`, ROOT)
await mkdir(out, { recursive: true })

const indices = canvasArgs.length ? canvasArgs.map(Number) : [Math.floor(canvases.length / 2)]
console.log(`${msId}  ${canvases.length} canvases  ${manifestUrl}`)

for (const i of indices) {
  const c = canvases[i]
  if (!c) { console.log(`  canvas ${i}: out of range`); continue }
  const body = c.items?.[0]?.items?.[0]?.body ?? c.images?.[0]?.resource
  const service = [].concat(body?.service ?? [])[0]
  const base = service?.id ?? service?.['@id']
  const w = c.width ?? body?.width
  const h = c.height ?? body?.height
  if (!base || !w) { console.log(`  canvas ${i}: no image service`); continue }
  const region = [
    Math.round(w * REGION[0]),
    Math.round(h * REGION[1]),
    Math.round(w * REGION[2]),
    Math.round(h * REGION[3]),
  ].join(',')
  const url = `${base}/${region}/${WIDTH === 'full' ? 'full' : `${WIDTH},`}/0/default.jpg`
  const file = new URL(`canvas_${i}.jpg`, out)
  const res = await fetch(url)
  if (!res.ok) { console.log(`  canvas ${i}: image ${res.status}`); continue }
  await writeFile(file, Buffer.from(await res.arrayBuffer()))
  console.log(`  canvas ${i}: predicts f.${(i - (i % 2)) / 2}${i % 2 ? 'v' : 'r'} at offset 0  ->  ${file.pathname}`)
}
