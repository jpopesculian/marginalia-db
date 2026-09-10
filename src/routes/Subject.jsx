import { Link, useParams } from 'react-router-dom'
import { Citation, Crumbs, PlateGrid } from '../components/Bits.jsx'
import { folioLink } from '../iiif.js'

export default function Subject({ data }) {
  const { id } = useParams()
  const subject = data.subjectById.get(id)

  if (!subject) {
    return (
      <div className="leaf wide">
        <div className="column">
          <h1>No such heading</h1>
          <p className="lede">
            Try the <Link to="/subjects">index of motifs</Link>.
          </p>
        </div>
      </div>
    )
  }

  const ancestors = []
  let cur = subject.parentId ? data.subjectById.get(subject.parentId) : null
  while (cur) {
    ancestors.unshift(cur)
    cur = cur.parentId ? data.subjectById.get(cur.parentId) : null
  }

  const children = subject.children.map((cid) => data.subjectById.get(cid)).filter(Boolean)
  const plates = data.figuresBySubject.get(subject.id) || []
  const namedPlates = subject.figures.map((f) => data.figureById.get(f)).filter(Boolean)
  const allPlates = [...new Map([...plates, ...namedPlates].map((f) => [f.id, f])).values()]

  const citations = subject.references.flatMap((r) =>
    r.folios.map((f) => ({ ref: r, folio: f }))
  )

  const openable = citations.filter(
    ({ ref, folio }) => folioLink(data.iiif[ref.manuscriptId], folio.folio)?.exact
  ).length

  return (
    <div className="leaf">
      <aside className="margin">
        <h2>In the index</h2>
        <p>
          {subject.letter} — page {subject.page ?? '—'} of the printed index.
        </p>
        {citations.length > 0 && (
          <>
            <p>
              {citations.length} {citations.length === 1 ? 'citation' : 'citations'} in{' '}
              {new Set(subject.references.map((r) => r.manuscriptId)).size} manuscripts.
            </p>
            <p>
              {openable === 0
                ? 'None of them can be opened: no holding library publishes a IIIF manifest for these books.'
                : `${openable} of them open the exact leaf.`}
            </p>
          </>
        )}
        {children.length > 0 && (
          <p>
            {children.length} narrower {children.length === 1 ? 'heading' : 'headings'}.
          </p>
        )}
      </aside>

      <div className="column">
        <Crumbs
          items={[
            { label: 'Motifs', to: '/subjects' },
            { label: subject.letter, to: `/subjects?letter=${subject.letter}` },
            ...ancestors.map((a) => ({ label: a.heading, to: `/subject/${a.id}` })),
            { label: subject.heading },
          ]}
        />

        <div className="title-block">
          <h1>
            {ancestors.length > 0 && (
              <span className="ancestry">{ancestors.map((a) => a.heading).join(': ')}: </span>
            )}
            {subject.heading}
          </h1>
        </div>

        {subject.asPrinted && <p className="printed">{subject.asPrinted}</p>}

        {subject.crossReferences.length > 0 && (
          <div style={{ marginBottom: '1.6rem' }}>
            {subject.crossReferences.map((x, i) => (
              <p className="xref" key={i}>
                <span className="kind">{x.type === 'see' ? 'See' : x.type === 'see_also' ? 'See also' : 'Compare'}</span>{' '}
                {x.targets.map((t, j) => {
                  const target = data.resolveCrossReference(t)
                  return (
                    <span key={j}>
                      {j > 0 && '; '}
                      {target ? <Link to={`/subject/${target}`}>{t}</Link> : <span>{t}</span>}
                    </span>
                  )
                })}
              </p>
            ))}
          </div>
        )}

        {children.length > 0 && (
          <>
            <h2 className="section-head">Narrower headings</h2>
            <ul className="tree">
              {children.map((c) => (
                <li key={c.id} style={{ paddingLeft: 0 }}>
                  <Link to={`/subject/${c.id}`}>{c.heading}</Link>
                  {c.references.length > 0 && (
                    <span className="refs">{c.references.reduce((a, r) => a + r.folios.length, 0)}</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {citations.length > 0 && (
          <>
            <h2 className="section-head">Where it is drawn</h2>
            <ul className="citations">
              {citations.map(({ ref, folio }, i) => (
                <Citation
                  key={i}
                  data={data}
                  manuscriptId={ref.manuscriptId}
                  manuscriptLabel={ref.manuscript}
                  folio={folio.folio}
                  note={folio.note}
                  figures={folio.figures}
                  volume={ref.volume}
                />
              ))}
            </ul>
          </>
        )}

        {allPlates.length > 0 && (
          <>
            <h2 className="section-head">Plates</h2>
            <PlateGrid figures={allPlates} />
          </>
        )}

        {citations.length === 0 && children.length === 0 && subject.crossReferences.length === 0 && (
          <p className="empty">Randall recorded this heading without citations of its own.</p>
        )}
      </div>
    </div>
  )
}
