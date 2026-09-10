// Turns the five raw database files plus the harvested IIIF index into the
// four JSON files the app loads at boot. Run by `npm run dev` and `npm run build`.
import { readFile, writeFile, mkdir, symlink, rm, stat } from 'node:fs/promises'
import { folioKeys } from './iiif-folio.mjs'

const ROOT = new URL('..', import.meta.url)
const read = async (p) => JSON.parse(await readFile(new URL(p, ROOT), 'utf8'))

const [manuscripts, digitized, figures, subjects] = await Promise.all([
  read('database/manuscripts.json'),
  read('database/digitized.json'),
  read('database/figures.json'),
  read('database/subjects.json'),
])
let iiifIndex = {}
try {
  iiifIndex = await read('database/iiif_index.json')
} catch {
  console.warn('no database/iiif_index.json — run `npm run harvest` to enable folio links')
}

const digitizedById = new Map(digitized.map((d) => [d.manuscript_id, d]))

// Manifests are ranked so that whole-book scans win over selected-leaf ones:
// a full manifest puts the cited folio in its real context.
const coverageRank = { full: 0, decorated: 1, selected: 2 }
function manifestsFor(record) {
  const list = (record?.resources || [])
    .filter((r) => r.type === 'iiif_manifest' && r.ok !== false)
    .map((r) => ({ ...r, idx: iiifIndex[r.url] }))
    .filter((r) => r.idx && !r.idx.error)
  list.sort(
    (a, b) =>
      (coverageRank[a.coverage] ?? 3) - (coverageRank[b.coverage] ?? 3) ||
      (b.idx.canvasCount || 0) - (a.idx.canvasCount || 0)
  )
  return list
}

const iiif = {}
const outManuscripts = manuscripts.map((m) => {
  const dig = digitizedById.get(m.id)
  const manifests = manifestsFor(dig)

  const folios = {}
  manifests.forEach((man, mi) => {
    for (const [token, canvasIdx] of Object.entries(man.idx.folios || {})) {
      if (!(token in folios)) folios[token] = [mi, canvasIdx]
    }
  })

  if (manifests.length) {
    iiif[m.id] = {
      manifests: manifests.map((r) => ({
        url: r.url,
        provider: r.provider,
        label: r.label,
        canvases: r.idx.canvasCount ?? r.canvases ?? null,
        coverage: r.coverage || null,
        foliated: !!r.idx.foliated,
      })),
      folios,
    }
  }

  return {
    id: m.id,
    aliases: m.aliases || [],
    city: m.city,
    institution: m.institution,
    shelfmark: m.shelfmark,
    popularName: m.popular_name,
    contents: m.contents,
    description: m.description,
    origin: m.origin,
    date: m.date,
    dimensions: m.dimensions?.as_printed || null,
    bibliography: m.bibliography || [],
    notes: m.notes,
    starred: !!m.starred,
    asPrinted: m.as_printed,
    figures: m.figures || [],
    holder: dig?.holder || null,
    digitizedShelfmark: dig?.shelfmark || null,
    status: dig?.status || 'none',
    digitizedNotes: dig?.notes || null,
    hasIiif: manifests.length > 0,
    // Kept for the record even when unlinkable, so a manuscript page can say
    // *why* there is no viewer link rather than staying silent.
    otherResources: (dig?.resources || [])
      .filter((r) => r.type !== 'iiif_manifest')
      .map((r) => ({ type: r.type, url: r.url, provider: r.provider })),
  }
})

const childrenOf = new Map()
for (const s of subjects) {
  if (!s.parent_id) continue
  if (!childrenOf.has(s.parent_id)) childrenOf.set(s.parent_id, [])
  childrenOf.get(s.parent_id).push(s.id)
}

const outSubjects = subjects.map((s) => ({
  id: s.id,
  heading: s.heading,
  level: s.level,
  parentId: s.parent_id,
  path: s.path,
  letter: s.letter,
  children: childrenOf.get(s.id) || [],
  crossReferences: s.cross_references || [],
  references: (s.references || []).map((r) => ({
    manuscriptId: r.manuscript_id,
    manuscript: r.manuscript,
    inherited: !!r.inherited,
    volume: r.volume,
    folios: (r.folios || []).map((f) => ({ folio: f.folio, note: f.note, figures: f.figures || [] })),
  })),
  figures: s.figures || [],
  asPrinted: s.as_printed,
  page: s.source?.printed_page ?? null,
}))

// Four plates reached us without a caption. Rather than render a blank card,
// fall back to the headings that point at the plate.
const subjectHeading = new Map(subjects.map((s) => [s.id, s.path.join(': ')]))

const outFigures = figures.map((f) => ({
  id: f.id,
  number: f.number,
  suffix: f.suffix,
  plate: f.plate,
  image: f.image,
  caption: f.caption || '',
  subjects:
    f.subjects?.length
      ? f.subjects
      : (f.subject_ids || []).map((id) => subjectHeading.get(id)).filter(Boolean),
  subjectIds: f.subject_ids || [],
  manuscriptId: f.manuscript_id,
  manuscript: f.manuscript,
  folio: f.folio,
  note: f.note,
}))

// Count how many cited folios actually resolve to a canvas — the headline number
// for how useful the deep links are, and worth surfacing in the app.
let citedFolios = 0
let resolvedFolios = 0
for (const s of outSubjects) {
  for (const r of s.references) {
    const entry = iiif[r.manuscriptId]
    for (const f of r.folios) {
      citedFolios++
      if (entry && folioKeys(f.folio).some((k) => k in entry.folios)) resolvedFolios++
    }
  }
}

const meta = {
  subjects: outSubjects.length,
  manuscripts: outManuscripts.length,
  figures: outFigures.length,
  manuscriptsWithIiif: Object.keys(iiif).length,
  citedFolios,
  resolvedFolios,
  builtAt: new Date().toISOString().slice(0, 10),
}

const outDir = new URL('public/data/', ROOT)
await mkdir(outDir, { recursive: true })
const write = (name, data) => writeFile(new URL(name, outDir), JSON.stringify(data))
await Promise.all([
  write('subjects.json', outSubjects),
  write('manuscripts.json', outManuscripts),
  write('figures.json', outFigures),
  write('iiif.json', iiif),
  write('meta.json', meta),
])

// The 741 plates live at repo root; link rather than copy 70MB into public/.
const link = new URL('public/figures', ROOT)
try {
  await stat(link)
} catch {
  await rm(link, { force: true, recursive: true }).catch(() => {})
  await symlink(new URL('figures', ROOT).pathname, link.pathname, 'dir')
}

console.log(JSON.stringify(meta, null, 2))
