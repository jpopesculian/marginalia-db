import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const n = (v) => v.toLocaleString('en-GB')

export default function Home({ data }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  // Plates whose subject is a creature or a scene rather than a page of text,
  // taken at a fixed stride so the foot of the page is the same band every visit.
  const band = useMemo(() => {
    const drolleries =
      /\bape|monkey|hare|rabbit|hybrid|grotesque|dragon|griffin|centaur|knight|tumbler|acrobat|musician|jongleur|stag|lion|fox|snail|joust|archer|dance|bagpipe|organ|unicorn|beast\b/i
    const pool = data.figures.filter((f) => drolleries.test(f.subjects.join(' ')))
    const step = Math.floor(pool.length / 12)
    return Array.from({ length: 12 }, (_, i) => pool[i * step]).filter(Boolean)
  }, [data])

  const notable = useMemo(
    () => data.manuscripts.filter((m) => m.starred && m.hasIiif).slice(0, 8),
    [data]
  )

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <h1>What lives in the margins</h1>
          <p className="lede">
            Lilian Randall catalogued {n(data.meta.subjects)} motifs from the borders and bas-de-page of{' '}
            {n(data.meta.manuscripts)} thirteenth- and fourteenth-century manuscripts: apes at the organ, hares
            turned hunter, knights losing to snails. Look one up, then open the leaf itself.
          </p>

          <form
            style={{ marginTop: '1.8rem' }}
            onSubmit={(e) => {
              e.preventDefault()
              if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`)
            }}
          >
            <div className="search-field">
              <label htmlFor="home-q" className="count">
                Find
              </label>
              <input
                id="home-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ape, tumbler, snail, blemya…"
                autoComplete="off"
              />
            </div>
            <p className="search-hint">
              Or read straight through the <Link to="/subjects">index of motifs</Link>.
            </p>
          </form>
        </div>

        <div className="bas-de-page" aria-hidden="false">
          {band.map((f, i) => (
            <Link
              key={f.id}
              to={`/figure/${f.id}`}
              style={{ animationDelay: `${120 + i * 45}ms` }}
              title={f.caption || f.subjects.join('; ')}
            >
              <img src={`${import.meta.env.BASE_URL}${f.image}`} alt={f.caption || f.subjects.join('; ')} />
            </Link>
          ))}
        </div>
      </section>

      <div className="leaf">
        <aside className="margin">
          <h2>The index at a glance</h2>
          <ul className="tally" style={{ flexDirection: 'column', gap: '0.35rem' }}>
            <li>
              <Link to="/subjects">
                <b>{n(data.meta.subjects)}</b> motifs
              </Link>
            </li>
            <li>
              <Link to="/manuscripts">
                <b>{n(data.meta.manuscripts)}</b> manuscripts
              </Link>
            </li>
            <li>
              <Link to="/figures">
                <b>{n(data.meta.figures)}</b> plates
              </Link>
            </li>
            <li>
              <b>{n(data.meta.resolvedFolios)}</b> citations open the exact leaf
            </li>
          </ul>
        </aside>

        <div className="column">
          <h2 className="section-head">How the leaf links work</h2>
          <p>
            A citation carries through to the digitised page only when the holding library publishes a IIIF
            manifest. {n(data.meta.manuscriptsWithIiif)} of the {n(data.meta.manuscripts)} manuscripts do.
          </p>
          <p>
            Where that manifest names its leaves — <span className="rubric">f. 63v</span> rather than{' '}
            <span className="count">Page 127</span> — the link opens the Universal Viewer on the folio Randall
            cited. Where it only numbers images, the link opens the manuscript at its first leaf and says so,
            because guessing at an offset would send you to the wrong page. Everything else carries no link at
            all.
          </p>

          <hr className="divider" />

          <h2 className="section-head">Manuscripts Randall starred, with images online</h2>
          <ul className="ms-list" style={{ maxWidth: '46rem' }}>
            {notable.map((m) => (
              <li key={m.id} className="ms-row">
                <Link className="ms-name" to={`/manuscript/${encodeURIComponent(m.id)}`}>
                  {m.id}
                </Link>
                <div className="ms-where">
                  {m.contents}
                  {m.date ? `, ${m.date}` : ''} — {m.city}
                </div>
                <div className="ms-flags">
                  <span className="flag-iiif">IIIF</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
