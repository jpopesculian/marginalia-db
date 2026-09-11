import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { searchFigures, searchManuscripts, searchSubjects } from '../data.js'
import { FilterBar, PlateGrid, SubjectList } from '../components/Bits.jsx'
import { SUBJECT_FILTERS, applyFilters, filterCounts, useFilters } from '../filters.js'

const SHOWN = 120

export default function Search({ data }) {
  const [params, setParams] = useSearchParams()
  const urlQ = params.get('q') || ''
  const [q, setQ] = useState(urlQ)
  const { active, toggle, clear } = useFilters()

  // What this input last wrote to the URL. Without it, our own write comes back
  // round and is mistaken for the user navigating: the debounced write triggers
  // a re-render long enough for more keystrokes to land, and adopting the URL
  // afterwards silently discards them.
  const pushed = useRef(urlQ)

  // Adopt the URL only when it changed for some other reason — back, forward, or
  // an inbound link. Keyed on the string, so toggling a filter does not reset it.
  useEffect(() => {
    if (urlQ === pushed.current) return
    pushed.current = urlQ
    setQ(urlQ)
  }, [urlQ])

  useEffect(() => {
    const next = q.trim()
    if (next === pushed.current) return
    const t = setTimeout(() => {
      pushed.current = next
      // Merge into whatever the params are when this fires; a filter toggled
      // during the debounce must not be dropped.
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (next) p.set('q', next)
          else p.delete('q')
          return p
        },
        { replace: true }
      )
    }, 200)
    return () => clearTimeout(t)
  }, [q, setParams])

  const term = (params.get('q') || '').trim()
  const allSubjects = useMemo(() => searchSubjects(data, term), [data, term])
  const counts = useMemo(() => filterCounts(allSubjects, SUBJECT_FILTERS, data), [allSubjects, data])
  const subjects = useMemo(
    () => applyFilters(allSubjects, SUBJECT_FILTERS, active, data),
    [allSubjects, active, data]
  )
  const manuscripts = useMemo(() => searchManuscripts(data, term), [data, term])
  const figures = useMemo(() => searchFigures(data, term), [data, term])

  const shown = subjects.slice(0, SHOWN)
  const filtering = active.size > 0

  return (
    <div className="leaf">
      <aside className="margin">
        <h2>Search</h2>
        {term.length < 2 ? (
          <p>
            Two letters or more. Words are matched against a heading and everything above it, so “ape
            physician” finds “Ape: as physician”.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li>
              {subjects.length.toLocaleString('en-GB')} motifs
              {filtering && ` of ${allSubjects.length.toLocaleString('en-GB')}`}
            </li>
            <li>{manuscripts.length} manuscripts</li>
            <li>{figures.length} plates</li>
          </ul>
        )}
      </aside>

      <div className="column">
        <div className="search-field" style={{ marginBottom: '1.4rem' }}>
          <label htmlFor="q" className="count">
            Find
          </label>
          <input
            id="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ape organist, tumbler, snail…"
            autoFocus
            autoComplete="off"
          />
        </div>

        {term.length >= 2 && (
          <FilterBar
            defs={SUBJECT_FILTERS}
            active={active}
            toggle={toggle}
            clear={clear}
            counts={counts}
            label="Filter motif results"
          />
        )}

        {term.length < 2 ? (
          <p className="empty">Type a motif, a shelfmark, or a place.</p>
        ) : subjects.length + manuscripts.length + figures.length === 0 ? (
          <p className="empty">
            {filtering && allSubjects.length > 0
              ? `${allSubjects.length} motifs match “${term}” but none passes every filter. Drop one to see them.`
              : `Nothing matches “${term}”. Randall's vocabulary is of its time — try “ape” rather than “monkey”, or “blemya” rather than “headless man”.`}
          </p>
        ) : (
          <>
            {subjects.length > 0 && (
              <>
                <h2 className="section-head">
                  Motifs{' '}
                  <span className="count">
                    ({shown.length.toLocaleString('en-GB')}
                    {subjects.length > shown.length && ` of ${subjects.length.toLocaleString('en-GB')}`})
                  </span>
                </h2>
                <SubjectList data={data} subjects={shown} />
              </>
            )}

            {manuscripts.length > 0 && (
              <>
                <h2 className="section-head">Manuscripts</h2>
                <ul className="ms-list">
                  {manuscripts.map((m) => (
                    <li key={m.id} className="ms-row">
                      <Link className="ms-name" to={`/manuscript/${encodeURIComponent(m.id)}`}>
                        {m.id}
                      </Link>
                      <div className="ms-where">
                        {[m.shelfmark, m.contents, m.date].filter(Boolean).join(', ')} — {m.city}
                      </div>
                      <div className="ms-flags">{m.hasIiif && <span className="flag-iiif">IIIF</span>}</div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {figures.length > 0 && (
              <>
                <h2 className="section-head">Plates</h2>
                <PlateGrid figures={figures} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
