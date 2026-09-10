import { Link, useParams } from 'react-router-dom'
import { Crumbs, plateAlt } from '../components/Bits.jsx'
import { folioLink, manuscriptLink } from '../iiif.js'

export default function Figure({ data }) {
  const { id } = useParams()
  const fig = data.figureById.get(id)

  if (!fig) {
    return (
      <div className="leaf wide">
        <div className="column">
          <h1>No such plate</h1>
          <p className="lede">
            Browse <Link to="/figures">all {data.figures.length} plates</Link>.
          </p>
        </div>
      </div>
    )
  }

  const ms = data.manuscriptById.get(fig.manuscriptId)
  // Randall did not record a folio for every plate. The manuscript may still be
  // online, so fall back to the whole-book link rather than claiming there is none.
  const entry = data.iiif[fig.manuscriptId]
  const link = fig.folio ? folioLink(entry, fig.folio) : manuscriptLink(entry)
  const subjects = fig.subjectIds.map((sid) => data.subjectById.get(sid)).filter(Boolean)

  const idx = data.figures.findIndex((f) => f.id === fig.id)
  const prev = data.figures[idx - 1]
  const next = data.figures[idx + 1]

  return (
    <div className="leaf">
      <aside className="margin">
        <h2>Plate {fig.number}{fig.suffix}</h2>
        {fig.plate && <p>Printed on plate {fig.plate}.</p>}
        {ms && (
          <p>
            <Link className="cite-ms" to={`/manuscript/${encodeURIComponent(ms.id)}`}>
              {ms.id}
            </Link>
            {fig.folio ? `, f. ${fig.folio}` : ''}
          </p>
        )}
        {link ? (
          <p>
            <a className={`folio-link${link.exact ? '' : ' approximate'}`} href={link.url} target="_blank" rel="noreferrer">
              {link.exact ? 'See this folio in colour' : 'Open the manuscript'}
            </a>
            <br />
            <span className="count">
              {link.exact
                ? `Universal Viewer, ${link.manifest.provider || 'IIIF'}`
                : fig.folio
                  ? 'The manifest does not name its leaves'
                  : 'Randall recorded no folio for this plate'}
            </span>
          </p>
        ) : (
          <p>No IIIF manifest is published for this manuscript.</p>
        )}
        <p className="count" style={{ marginTop: '1.4rem' }}>
          {prev && <Link to={`/figure/${prev.id}`}>Previous plate</Link>}
          {prev && next && <br />}
          {next && <Link to={`/figure/${next.id}`}>Next plate</Link>}
        </p>
      </aside>

      <div className="column">
        <Crumbs items={[{ label: 'Plates', to: '/figures' }, { label: `Fig. ${fig.number}${fig.suffix}` }]} />

        <div className="plate-full">
          <img src={`${import.meta.env.BASE_URL}${fig.image}`} alt={plateAlt(fig)} />
        </div>

        <p className="printed" style={{ marginTop: '1.2rem' }}>
          {fig.caption || 'Randall printed this plate without a caption.'}
        </p>

        {fig.note && <p className="count">{fig.note}</p>}

        {subjects.length > 0 && (
          <>
            <h2 className="section-head">In the index</h2>
            <ul className="entry-list">
              {subjects.map((s) => (
                <li key={s.id} className="entry">
                  <Link className="entry-head" to={`/subject/${s.id}`}>
                    {s.path.join(': ')}
                  </Link>
                  <div className="entry-meta">
                    {s.references.reduce((a, r) => a + r.folios.length, 0) || 'No'} citations
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
