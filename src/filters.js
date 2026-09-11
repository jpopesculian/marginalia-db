// Filter definitions shared by the Motifs, Search and Manuscripts pages.
// The predicates read flags precomputed in data.js, so toggling stays cheap
// even when the candidate set is every heading under M.
import { useSearchParams } from 'react-router-dom'
import { folioLink } from './iiif.js'

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

// The same two predicates as above, evaluated one level finer. A heading matches
// "opens a folio" exactly when one of its citations does, so filtering a subject
// page narrows the citations by the identical test that selected the heading.
// `cited` has no meaning here — every citation is a citation — so it is absent.
export const CITATION_FILTERS = [
  {
    key: 'plate',
    label: 'With a plate',
    title: 'Citations Randall reproduced in a photographic plate',
    test: (c) => c.figures.length > 0,
  },
  {
    key: 'folio',
    label: 'Opens a folio',
    title: 'Citations that open the exact leaf in a viewer',
    test: (c, data) => !!folioLink(data.iiif[c.manuscriptId], c.folio)?.exact,
  },
]

// Shared keys carry the same meaning here as on the heading and citation bars,
// so `?f=plate,folio` reads the same whichever page you are on. `online` is the
// one manuscript-only axis; there is no useful heading-level equivalent.
export const MANUSCRIPT_FILTERS = [
  {
    key: 'plate',
    label: 'With a plate',
    title: 'Manuscripts reproduced in at least one plate',
    test: (m, data) => data.manuscriptFlags.get(m.id).plate,
  },
  {
    key: 'folio',
    label: 'Opens a folio',
    title: 'Manuscripts where at least one cited folio opens the exact leaf',
    test: (m, data) => data.manuscriptFlags.get(m.id).folio,
  },
  {
    key: 'online',
    label: 'Images online',
    title: 'Manuscripts whose holding library publishes a IIIF manifest',
    test: (m, data) => data.manuscriptFlags.get(m.id).online,
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

// Carries the active filters along an internal link, so the set survives moving
// between the Motifs, Search and subject pages. Top-level navigation does not
// use this — switching section is meant to start clean.
export function useFilterHref() {
  const [params] = useSearchParams()
  const f = params.get('f')
  return (path) =>
    f ? `${path}${path.includes('?') ? '&' : '?'}f=${encodeURIComponent(f)}` : path
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
