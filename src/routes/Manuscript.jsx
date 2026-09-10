import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Citation, Crumbs, PlateGrid } from '../components/Bits.jsx'
import { viewerUrl } from '../iiif.js'

const PAGE = 150

export default function Manuscript({ data }) {
  const { id } = useParams()
  const ms = data.manuscriptById.get(decodeURIComponent(id))
  const [shown, setShown] = useState(PAGE)

  const citations = useMemo(() => (ms ? data.citationsByManuscript.get(ms.id) || [] : []), [data, ms])

  if (!ms) {
    return (
      <div className="leaf wide">
        <div className="column">
          <h1>No such manuscript</h1>
          <p className="lede">
            Browse the <Link to="/manuscripts">232 books in the key</Link>.
          </p>
        </div>
      </div>
    )
  }

  const entry = data.iiif[ms.id]
  const plates = data.figuresByManuscript.get(ms.id) || []

  return (
    <div className="leaf">
      <aside className="margin">
        <h2>Digitised images</h2>
        {entry ? (
          <>
            <p>
              {entry.manifests.length === 1
                ? 'One IIIF manifest.'
                : `${entry.manifests.length} IIIF manifests.`}{' '}
              {Object.keys(entry.folios).length > 0
                ? `${Object.keys(entry.folios).length} leaves are named, so citations open the folio itself.`
                : 'The manifest numbers images rather than naming leaves, so links open the book at its first leaf.'}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {entry.manifests.map((m, i) => (
                <li key={i} style={{ marginBottom: '0.6rem' }}>
                  <a className="folio-link" href={viewerUrl(m.url)} target="_blank" rel="noreferrer">
                    Open in the Universal Viewer
                  </a>
                  <div className="count">
                    {[m.provider, m.coverage, m.canvases ? `${m.canvases} images` : null]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>
            No IIIF manifest is published for this manuscript, so there is nothing to link to.
            {ms.status === 'partial' || ms.status === 'online'
              ? ' Images exist elsewhere but not in a form this index can open on a folio.'
              : ''}
          </p>
        )}
      </aside>

      <div className="column">
        <Crumbs items={[{ label: 'Manuscripts', to: '/manuscripts' }, { label: ms.id }]} />

        <div className="title-block">
          <h1>{ms.id}</h1>
          <p className="sub">
            {[ms.shelfmark, ms.institution, ms.city].filter(Boolean).join(' — ')}
          </p>
        </div>

        <dl className="facts" style={{ marginTop: '1.4rem' }}>
          {ms.contents && (
            <div>
              <dt>Contents</dt>
              <dd>{ms.contents}</dd>
            </div>
          )}
          {ms.origin && (
            <div>
              <dt>Origin</dt>
              <dd>{ms.origin}</dd>
            </div>
          )}
          {ms.date && (
            <div>
              <dt>Date</dt>
              <dd>{ms.date}</dd>
            </div>
          )}
          {ms.dimensions && (
            <div>
              <dt>Leaf</dt>
              <dd>{ms.dimensions}</dd>
            </div>
          )}
          {ms.popularName && (
            <div>
              <dt>Known as</dt>
              <dd>{ms.popularName}</dd>
            </div>
          )}
          {ms.aliases.length > 0 && (
            <div>
              <dt>Also cited as</dt>
              <dd>{ms.aliases.join(', ')}</dd>
            </div>
          )}
          {ms.notes && (
            <div>
              <dt>Note</dt>
              <dd>{ms.notes}</dd>
            </div>
          )}
          {ms.bibliography.length > 0 && (
            <div>
              <dt>Bibliography</dt>
              <dd>{ms.bibliography.join('; ')}</dd>
            </div>
          )}
        </dl>

        {plates.length > 0 && (
          <>
            <h2 className="section-head">Plates from this manuscript</h2>
            <PlateGrid figures={plates} />
          </>
        )}

        <h2 className="section-head">
          Motifs recorded here <span className="count">({citations.length})</span>
        </h2>
        {citations.length === 0 ? (
          <p className="empty">Randall's index cites no motifs from this manuscript.</p>
        ) : (
          <>
            <ul className="citations">
              {citations.slice(0, shown).map((c, i) => {
                const s = data.subjectById.get(c.subjectId)
                return (
                  <Citation
                    key={i}
                    data={data}
                    manuscriptId={ms.id}
                    folio={c.folio}
                    note={c.note}
                    figures={c.figures}
                    volume={c.volume}
                    subjectId={c.subjectId}
                    subjectPath={s ? s.path.join(': ') : c.subjectId}
                  />
                )
              })}
            </ul>
            {shown < citations.length && (
              <div className="filters" style={{ marginTop: '1.2rem' }}>
                <button onClick={() => setShown((v) => v + PAGE)}>
                  Show {Math.min(PAGE, citations.length - shown)} more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
