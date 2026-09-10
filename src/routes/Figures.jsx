import { useMemo, useState } from 'react'
import { PlateGrid } from '../components/Bits.jsx'

const PAGE = 96

export default function Figures({ data }) {
  const [q, setQ] = useState('')
  const [shown, setShown] = useState(PAGE)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return data.figures
    return data.figures.filter((f) =>
      [f.caption, ...(f.subjects || [])].filter(Boolean).some((v) => v.toLowerCase().includes(needle))
    )
  }, [data, q])

  return (
    <div className="leaf">
      <aside className="margin">
        <h2>Plates</h2>
        <p>
          {data.figures.length} photographs reproduced in Randall's plates, drawn from{' '}
          {new Set(data.figures.map((f) => f.manuscriptId)).size} manuscripts.
        </p>
        <p>Showing {Math.min(shown, rows.length)} of {rows.length}.</p>
      </aside>

      <div className="column">
        <div className="title-block" style={{ marginBottom: '1.2rem' }}>
          <h1>The plates</h1>
        </div>

        <div className="search-field" style={{ maxWidth: '24rem', marginBottom: '1.6rem' }}>
          <label htmlFor="fig-q" className="count">
            Find
          </label>
          <input
            id="fig-q"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setShown(PAGE)
            }}
            placeholder="ape, hare, grotesque…"
            style={{ fontSize: 'var(--step-1)' }}
            autoComplete="off"
          />
        </div>

        {rows.length === 0 ? (
          <p className="empty">No plate caption mentions that. Try a broader word.</p>
        ) : (
          <>
            <PlateGrid figures={rows.slice(0, shown)} />
            {shown < rows.length && (
              <div className="filters" style={{ marginTop: '2rem' }}>
                <button onClick={() => setShown((v) => v + PAGE)}>
                  Show {Math.min(PAGE, rows.length - shown)} more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
