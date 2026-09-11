// Two loads, not one. The home page needs meta, manuscripts and figures — a
// tenth of the payload — so those are fetched separately and the first screen
// paints without waiting on the 4.6 MB index. Every request starts at the same
// moment; only the resolving is staged. Nothing fetches twice.
import { folioLink } from './iiif.js'

let shellCache = null
let cache = null

const fetchJson = (name) =>
  fetch(`${import.meta.env.BASE_URL}data/${name}.json`).then((r) => {
    if (!r.ok) throw new Error(`${name}.json failed to load (${r.status})`)
    return r.json()
  })

// Enough for the home page: the counts, the plates band, and the starred
// manuscripts. No headings, so no waiting for the index.
export function loadShell() {
  if (shellCache) return shellCache
  shellCache = Promise.all([fetchJson('meta'), fetchJson('manuscripts'), fetchJson('figures')]).then(
    ([meta, manuscripts, figures]) => ({ meta, manuscripts, figures })
  )
  return shellCache
}

export function loadData() {
  if (cache) return cache
  cache = (async () => {
    const [shell, subjects, iiif] = await Promise.all([
      loadShell(),
      fetchJson('subjects'),
      fetchJson('iiif'),
    ])
    const { meta, manuscripts, figures } = shell

    const subjectById = new Map(subjects.map((s) => [s.id, s]))
    const manuscriptById = new Map(manuscripts.map((m) => [m.id, m]))
    const figureById = new Map(figures.map((f) => [f.id, f]))

    // Headings are indexed alongside their ancestors so that searching "ape
    // physician" finds "Ape: as physician" even though no single heading says it.
    const searchable = subjects.map((s) => ({
      id: s.id,
      text: s.path.join(' ').toLowerCase(),
      heading: s.heading.toLowerCase(),
      refs: s.references.length,
    }))

    const rootsByLetter = new Map()
    for (const s of subjects) {
      if (s.level !== 0) continue
      if (!rootsByLetter.has(s.letter)) rootsByLetter.set(s.letter, [])
      rootsByLetter.get(s.letter).push(s)
    }
    const letters = [...rootsByLetter.keys()].sort()

    // Every citation, turned inside out so a manuscript page can list the motifs
    // recorded on each of its leaves.
    const citationsByManuscript = new Map()
    for (const s of subjects) {
      for (const r of s.references) {
        if (!r.manuscriptId) continue
        if (!citationsByManuscript.has(r.manuscriptId)) citationsByManuscript.set(r.manuscriptId, [])
        const list = citationsByManuscript.get(r.manuscriptId)
        for (const f of r.folios) {
          list.push({ subjectId: s.id, folio: f.folio, note: f.note, figures: f.figures, volume: r.volume })
        }
      }
    }
    for (const list of citationsByManuscript.values()) list.sort(byFolio)

    const figuresByManuscript = new Map()
    for (const f of figures) {
      if (!figuresByManuscript.has(f.manuscriptId)) figuresByManuscript.set(f.manuscriptId, [])
      figuresByManuscript.get(f.manuscriptId).push(f)
    }

    const figuresBySubject = new Map()
    for (const f of figures) {
      for (const sid of f.subjectIds) {
        if (!figuresBySubject.has(sid)) figuresBySubject.set(sid, [])
        figuresBySubject.get(sid).push(f)
      }
    }

    const allByLetter = new Map()
    for (const s of subjects) {
      if (!allByLetter.has(s.letter)) allByLetter.set(s.letter, [])
      allByLetter.get(s.letter).push(s)
    }

    // Filter predicates read these instead of walking references on every
    // keystroke. One pass here, constant-time lookups afterwards.
    const subjectFlags = new Map()
    for (const s of subjects) {
      let cited = false
      let folio = false
      for (const r of s.references) {
        for (const f of r.folios) {
          cited = true
          if (!folio && folioLink(iiif[r.manuscriptId], f.folio)?.exact) folio = true
        }
      }
      subjectFlags.set(s.id, {
        cited,
        folio,
        plate: figuresBySubject.has(s.id) || s.figures.length > 0,
      })
    }

    const manuscriptFlags = new Map()
    for (const m of manuscripts) {
      const entry = iiif[m.id]
      const cites = citationsByManuscript.get(m.id) || []
      manuscriptFlags.set(m.id, {
        online: !!entry,
        // The same test the citation and heading filters use, lifted one level:
        // a manuscript opens a folio when at least one folio Randall cites
        // resolves to a canvas. A foliated manifest alone is not enough — 13 of
        // them name leaves that this index never cites.
        folio: !!entry && cites.some((c) => folioLink(entry, c.folio)?.exact),
        plate: figuresByManuscript.has(m.id),
      })
    }

    return {
      subjects,
      manuscripts,
      figures,
      iiif,
      meta,
      subjectById,
      manuscriptById,
      figureById,
      searchable,
      rootsByLetter,
      allByLetter,
      letters,
      subjectFlags,
      manuscriptFlags,
      citationsByManuscript,
      figuresByManuscript,
      figuresBySubject,
    }
  })()
  return cache
}

// Folios sort as scribes read them: 12r before 12v before 13r.
export function byFolio(a, b) {
  const pa = parseFolio(a.folio)
  const pb = parseFolio(b.folio)
  return pa[0] - pb[0] || pa[1] - pb[1] || String(a.folio).localeCompare(String(b.folio))
}

function parseFolio(raw) {
  const m = String(raw || '').match(/(\d+)\s*([rv])?/)
  if (!m) return [Infinity, 0]
  return [parseInt(m[1], 10), m[2] === 'v' ? 1 : 0]
}

export function searchSubjects(data, query) {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const terms = q.split(/\s+/)
  const results = []
  for (const s of data.searchable) {
    if (!terms.every((t) => s.text.includes(t))) continue
    let score = 3
    if (s.heading === q) score = 0
    else if (s.heading.startsWith(q)) score = 1
    else if (s.heading.includes(q)) score = 2
    results.push({ id: s.id, score, refs: s.refs })
  }
  results.sort((a, b) => a.score - b.score || b.refs - a.refs)
  return results.map((r) => data.subjectById.get(r.id))
}

export function searchManuscripts(data, query, limit = 30) {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  return data.manuscripts
    .filter((m) =>
      [m.id, m.shelfmark, m.city, m.institution, m.contents, m.popularName, ...(m.aliases || [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
    .slice(0, limit)
}

export function searchFigures(data, query, limit = 60) {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  return data.figures
    .filter((f) =>
      [f.caption, ...(f.subjects || [])].filter(Boolean).some((v) => v.toLowerCase().includes(q))
    )
    .slice(0, limit)
}
