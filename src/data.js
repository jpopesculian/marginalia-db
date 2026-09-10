// One boot load of the four prepared files, then every index the app needs is
// derived in memory. Nothing here fetches again.
import { folioLink } from './iiif.js'

let cache = null

export function loadData() {
  if (cache) return cache
  cache = (async () => {
    const [subjects, manuscripts, figures, iiif, meta] = await Promise.all(
      ['subjects', 'manuscripts', 'figures', 'iiif', 'meta'].map((n) =>
        fetch(`/data/${n}.json`).then((r) => {
          if (!r.ok) throw new Error(`${n}.json failed to load (${r.status})`)
          return r.json()
        })
      )
    )

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
      manuscriptFlags.set(m.id, {
        iiif: !!entry,
        folio: !!entry && Object.keys(entry.folios).length > 0,
        plates: figuresByManuscript.has(m.id),
      })
    }

    // Randall's cross-references point at printed heading paths ("Virgin,
    // miracles of: sacristan"), not ids. Resolve what we can to real links.
    const byPathKey = new Map()
    for (const s of subjects) {
      const key = normalize(s.path.join(': '))
      if (!byPathKey.has(key)) byPathKey.set(key, s.id)
      const hkey = normalize(s.heading)
      if (s.level === 0 && !byPathKey.has(hkey)) byPathKey.set(hkey, s.id)
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
      resolveCrossReference: (target) => byPathKey.get(normalize(target)) || null,
    }
  })()
  return cache
}

const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9: ]+/g, '').replace(/\s+/g, ' ').trim()

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
