import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FilterBar } from '../components/Bits.jsx'
import { MANUSCRIPT_FILTERS, applyFilters, filterCounts, useFilters } from '../filters.js'

export default function Manuscripts({ data }) {
  const [city, setCity] = useState('')
  const [q, setQ] = useState('')
  const { active, toggle, clear } = useFilters()

  const cities = useMemo(
    () => [...new Set(data.manuscripts.map((m) => m.city).filter(Boolean))].sort(),
    [data]
  )

  // Counts describe what the toggles would find within the current city and
  // text search, so they track the list the reader is actually looking at.
  const scope = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return data.manuscripts.filter(
      (m) =>
        (!city || m.city === city) &&
        (!needle ||
          [m.id, m.shelfmark, m.institution, m.contents, m.popularName, ...(m.aliases || [])]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(needle)))
    )
  }, [data, city, q])

  const counts = useMemo(() => filterCounts(scope, MANUSCRIPT_FILTERS, data), [scope, data])
  const rows = useMemo(
    () =>
      applyFilters(scope, MANUSCRIPT_FILTERS, active, data).sort((a, b) =>
        a.id.localeCompare(b.id, 'en', { numeric: true })
      ),
    [scope, active, data]
  )

  const withIiif = data.manuscripts.filter((m) => m.hasIiif).length

  return (
    <div className="leaf">
      <aside className="margin">
        <h2>Manuscripts</h2>
        <p>
          {data.manuscripts.length} books make up Randall's key. {withIiif} publish a IIIF manifest and can
          be opened here.
        </p>
        <p>
          Showing {rows.length}
          {rows.length !== data.manuscripts.length && ` of ${data.manuscripts.length}`}.
        </p>
      </aside>

      <div className="column">
        <div className="title-block" style={{ marginBottom: '1.2rem' }}>
          <h1>The manuscripts</h1>
        </div>

        <div className="search-field" style={{ maxWidth: '24rem', marginBottom: '1.1rem' }}>
          <label htmlFor="ms-q" className="count">
            Find
          </label>
          <input
            id="ms-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Bodley, psalter, Ghent…"
            style={{ fontSize: 'var(--step-1)' }}
            autoComplete="off"
          />
        </div>

        <div className="filters">
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-label="City"
            style={{
              font: 'inherit',
              fontSize: 'var(--step--1)',
              color: city ? 'var(--ink)' : 'var(--faded)',
              background: 'none',
              border: '1px solid var(--rule)',
              borderRadius: 2,
              padding: '0.2rem 0.4rem',
            }}
          >
            <option value="">Every city</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <FilterBar
          defs={MANUSCRIPT_FILTERS}
          active={active}
          toggle={toggle}
          clear={clear}
          counts={counts}
          label="Filter manuscripts"
        />

        {rows.length === 0 ? (
          <p className="empty">
            Nothing matches every filter. Drop one, widen the city, or shorten the search.
          </p>
        ) : (
          <ul className="ms-list">
            {rows.map((m) => {
              const cites = data.citationsByManuscript.get(m.id)?.length || 0
              const flags = data.manuscriptFlags.get(m.id)
              return (
                <li key={m.id} className="ms-row">
                  <Link className="ms-name" to={`/manuscript/${encodeURIComponent(m.id)}`}>
                    {m.id}
                  </Link>
                  <div className="ms-where">
                    {[m.shelfmark, m.contents, m.date].filter(Boolean).join(', ')}
                    {m.institution ? ` — ${m.institution}, ${m.city}` : ''}
                  </div>
                  <div className="ms-flags">
                    {flags.iiif && (
                      <div className="flag-iiif">{flags.folio ? 'IIIF, folio links' : 'IIIF'}</div>
                    )}
                    {cites > 0 && (
                      <div>
                        {cites} {cites === 1 ? 'motif' : 'motifs'}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
