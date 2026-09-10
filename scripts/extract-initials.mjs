// Converts the Kingfall Initials capitals into standalone SVG artwork, once, so
// the app ships drawn letters instead of a licensed font file.
//
// Every letter shares one viewBox height — the union of all their ink bounds —
// so the set keeps the proportions the font gives it. Only the width varies,
// by each glyph's own advance.
//
//   npm run initials            (needs ./fonts, see `npm run fonts`)
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import opentype from 'opentype.js'

const ROOT = new URL('..', import.meta.url)
const SRC = new URL('fonts/kingfall-initials-webfont.woff', ROOT)
const OUT = new URL('public/initials/', ROOT)
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const INK = '#2b2620'

let buf
try {
  buf = await readFile(SRC)
} catch {
  console.error(`No font at ${SRC.pathname}`)
  console.error('Run `npm run fonts <path-to-Kingfall>` first; the SVGs only need regenerating if the font changes.')
  process.exit(1)
}

const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))

const glyphs = LETTERS.map((ch) => {
  const g = font.charToGlyph(ch)
  if (!g || g.index === 0) return null
  const path = g.getPath(0, 0, font.unitsPerEm)
  const bb = path.getBoundingBox()
  return { ch, glyph: g, path, bb, advance: g.advanceWidth }
}).filter(Boolean)

// One shared vertical frame keeps R the same visual size as Q, tail and all.
const top = Math.min(...glyphs.map((g) => g.bb.y1))
const bottom = Math.max(...glyphs.map((g) => g.bb.y2))
const height = bottom - top

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

for (const g of glyphs) {
  // getPath draws y-down from a y-up baseline, so the box starts at the highest ink.
  const width = Math.max(g.advance, g.bb.x2)
  const d = g.path.toPathData(2)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${round(top)} ${round(width)} ${round(height)}" ` +
    `role="img" aria-label="${g.ch}"><path fill="${INK}" d="${d}"/></svg>\n`
  await writeFile(new URL(`${g.ch}.svg`, OUT), svg)
}

const sizes = await Promise.all(
  glyphs.map(async (g) => (await readFile(new URL(`${g.ch}.svg`, OUT))).length)
)
console.log(
  `${glyphs.length} initials written to public/initials — ` +
    `${(sizes.reduce((a, b) => a + b, 0) / 1024).toFixed(0)} KB total, ` +
    `${(Math.max(...sizes) / 1024).toFixed(1)} KB largest`
)

function round(n) {
  return Math.round(n * 100) / 100
}
