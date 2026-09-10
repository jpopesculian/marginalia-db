// Filter definitions shared by the Motifs, Search and Manuscripts pages.
// The predicates read flags precomputed in data.js, so toggling stays cheap
// even when the candidate set is every heading under M.
import { useSearchParams } from 'react-router-dom'

export const SUBJECT_FILTERS = [
  {
    key: 'plate',
    label: 'With a plate',
    title: 'Headings that Randall reproduced in a photographic plate',
    test: (s, data) => data.subjectFlags.get(s.id).plate,
  },
  {
    key: 'folio',
    label: 'Opens a folio',
    title: 'Headings with at least one citation that opens the exact leaf in a viewer',
    test: (s, data) => data.subjectFlags.get(s.id).folio,
  },
  {
    key: 'cited',
    label: 'Cited in a manuscript',
    title: 'Headings with citations of their own, rather than only pointing elsewhere',
    test: (s, data) => data.subjectFlags.get(s.id).cited,
  },
]

export const MANUSCRIPT_FILTERS = [
  {
    key: 'iiif',
    label: 'Images online',
    title: 'Manuscripts whose holding library publishes a IIIF manifest',
    test: (m, data) => data.manuscriptFlags.get(m.id).iiif,
  },
  {
    key: 'folio',
    label: 'Folio links',
    title: 'Manifests that name their leaves, so citations open the folio itself',
    test: (m, data) => data.manuscriptFlags.get(m.id).folio,
  },
  {
    key: 'plates',
    label: 'With plates',
    title: 'Manuscripts reproduced in at least one plate',
    test: (m, data) => data.manuscriptFlags.get(m.id).plates,
  },
]

// Active filters live in the query string so they survive letter navigation
// and can be shared as a link.
export function useFilters() {
  const [params, setParams] = useSearchParams()
  const active = new Set((params.get('f') || '').split(',').filter(Boolean))

  const toggle = (key) => {
    const next = new Set(active)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    const p = new URLSearchParams(params)
    if (next.size) p.set('f', [...next].join(','))
    else p.delete('f')
    setParams(p, { replace: true })
  }

  const clear = () => {
    const p = new URLSearchParams(params)
    p.delete('f')
    setParams(p, { replace: true })
  }

  return { active, toggle, clear }
}

export function applyFilters(items, defs, active, data) {
  if (!active.size) return items
  const chosen = defs.filter((d) => active.has(d.key))
  return items.filter((it) => chosen.every((d) => d.test(it, data)))
}

// How many of the current candidates each filter would match on its own.
// Deliberately independent of the other active filters, so a count never
// changes meaning as you toggle.
export function filterCounts(items, defs, data) {
  const counts = {}
  for (const d of defs) counts[d.key] = 0
  for (const it of items) {
    for (const d of defs) if (d.test(it, data)) counts[d.key]++
  }
  return counts
}
