import { Link } from 'react-router-dom'
import { folioLink, manuscriptLink } from '../iiif.js'

export function Crumbs({ items }) {
  return (
    <nav className="crumbs">
      {items.map((it, i) => (
        <span key={i}>
          {i > 0 && <span className="sep">·</span>}
          {it.to ? <Link to={it.to}>{it.label}</Link> : <span>{it.label}</span>}
        </span>
      ))}
    </nav>
  )
}

export function HeadingPath({ path }) {
  return (
    <span className="entry-path">
      {path.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="sep">›</span>}
          {p}
        </span>
      ))}
    </span>
  )
}

// One line of the index: which book, which leaf, what is drawn there, and — only
// when a IIIF manifest exists — a way through to the leaf itself.
export function Citation({ data, manuscriptId, manuscriptLabel, folio, note, figures, volume, subjectId, subjectPath }) {
  const ms = data.manuscriptById.get(manuscriptId)
  const entry = data.iiif[manuscriptId]
  const link = folio ? folioLink(entry, folio) : manuscriptLink(entry)

  return (
    <li className="citation">
      {subjectPath ? (
        <Link className="cite-ms" to={`/subject/${subjectId}`}>
          {subjectPath}
        </Link>
      ) : ms ? (
        <Link className="cite-ms" to={`/manuscript/${encodeURIComponent(ms.id)}`} title={ms.shelfmark ? `${ms.shelfmark} — ${[ms.institution, ms.city].filter(Boolean).join(', ')}` : undefined}>
          {ms.id}
        </Link>
      ) : (
        <span className="cite-ms">{manuscriptLabel || manuscriptId || 'unattributed'}</span>
      )}

      {folio && (
        <span className="cite-folio">
          f. {folio}
          {volume ? `, ${volume}` : ''}
        </span>
      )}

      {note && <span className="cite-note">{note}</span>}

      <span className="cite-actions">
        {figures?.map((fid) => (
          <Link key={fid} className="plate-link" to={`/figure/${fid}`}>
            plate {fid}
          </Link>
        ))}
        {link && (
          <a
            className={`folio-link${link.exact ? '' : ' approximate'}`}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            title={
              link.exact
                ? `Opens f. ${folio} in the Universal Viewer — ${link.manifest.provider || 'IIIF'}`
                : `This manifest does not label its folios. Opens the manuscript at its first leaf — ${link.manifest.provider || 'IIIF'}`
            }
          >
            {link.exact ? 'View this folio' : 'View the manuscript'}
          </a>
        )}
      </span>
    </li>
  )
}

// Toggle row shared by the Motifs, Search and Manuscripts pages. Counts are for
// the current scope, so an empty filter is visibly not worth pressing.
export function FilterBar({ defs, active, toggle, clear, counts, label }) {
  return (
    <div className="filters" role="group" aria-label={label}>
      {defs.map((d) => {
        const on = active.has(d.key)
        const count = counts?.[d.key]
        return (
          <button
            key={d.key}
            type="button"
            aria-pressed={on}
            title={d.title}
            disabled={count === 0 && !on}
            onClick={() => toggle(d.key)}
          >
            {d.label}
            {count != null && <span className="filter-count">{count.toLocaleString('en-GB')}</span>}
          </button>
        )
      })}
      {active.size > 0 && (
        <button type="button" className="filter-clear" onClick={clear}>
          Clear filters
        </button>
      )}
    </div>
  )
}

// A heading with no citations of its own is not empty — it usually points
// somewhere else, and saying "0 citations" hides that.
function entryMeta(s) {
  const cites = s.references.reduce((a, r) => a + r.folios.length, 0)
  const parts = []
  if (cites) parts.push(`${cites} ${cites === 1 ? 'citation' : 'citations'}`)
  if (s.children.length)
    parts.push(`${s.children.length} narrower ${s.children.length === 1 ? 'heading' : 'headings'}`)
  if (!parts.length) {
    const xref = s.crossReferences[0]
    if (xref)
      return `${xref.type === 'see' ? 'See' : xref.type === 'see_also' ? 'See also' : 'Compare'} ${xref.targets.join('; ')}`
    return 'Recorded without citations'
  }
  return parts.join(', ')
}

export function SubjectList({ data, subjects }) {
  return (
    <ul className="entry-list">
      {subjects.map((s) => {
        const flags = data.subjectFlags.get(s.id)
        const ancestry = s.path.slice(0, -1)
        return (
          <li key={s.id} className="entry">
            <Link className="entry-head" to={`/subject/${s.id}`}>
              {ancestry.length > 0 && (
                <span className="entry-path">
                  {ancestry.join(' › ')}
                  <span className="sep">›</span>
                </span>
              )}
              {s.heading}
            </Link>
            <div className="entry-meta">
              {entryMeta(s)}
              {flags?.plate && <span className="pill">plate</span>}
              {flags?.folio && <span className="pill">opens a folio</span>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function plateAlt(f) {
  return f.caption || f.subjects.join('; ') || `Plate ${f.number}${f.suffix}`
}

export function PlateGrid({ figures }) {
  return (
    <ul className="plate-grid">
      {figures.map((f) => (
        <li key={f.id}>
          <Link className="plate-card" to={`/figure/${f.id}`}>
            <figure>
              <div className="frame">
                <img src={`/${f.image}`} alt={plateAlt(f)} loading="lazy" />
              </div>
              <figcaption>
                <b>
                  Fig. {f.number}
                  {f.suffix}
                </b>{' '}
                {f.subjects.length ? f.subjects.join('; ') : 'Caption not recorded'}
              </figcaption>
            </figure>
          </Link>
        </li>
      ))}
    </ul>
  )
}
