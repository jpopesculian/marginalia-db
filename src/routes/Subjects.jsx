import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FilterBar, SubjectList } from '../components/Bits.jsx'
import { SUBJECT_FILTERS, applyFilters, filterCounts, useFilters } from '../filters.js'
import { useSearchParams } from 'react-router-dom'

export default function Subjects({ data }) {
  const [params] = useSearchParams()
  const letter = params.get('letter') || data.letters[0]
  const { active, toggle, clear } = useFilters()

  const roots = data.rootsByLetter.get(letter) || []
  const all = useMemo(() => data.allByLetter.get(letter) || [], [data, letter])
  const counts = useMemo(() => filterCounts(all, SUBJECT_FILTERS, data), [all, data])
  const matches = useMemo(
    () => (active.size ? applyFilters(all, SUBJECT_FILTERS, active, data) : []),
    [all, active, data]
  )

  const filtering = active.size > 0
  const suffix = active.size ? `&f=${[...active].join(',')}` : ''

  return (
    <div className="leaf">
      <aside className="margin">
        <h2>Index of motifs</h2>
        <div className="letter-rail">
          {data.letters.map((l) => (
            <Link
              key={l}
              to={`/subjects?letter=${l}${suffix}`}
              className={l === letter ? 'active' : undefined}
            >
              {l}
            </Link>
          ))}
        </div>
        <p>
          {filtering
            ? `${matches.length} of ${all.length} headings under ${letter} match.`
            : `${roots.length} headings under ${letter}. Nested entries follow Randall's printed hierarchy.`}
        </p>
        {filtering && <p>Filtering flattens the hierarchy so narrower headings surface too.</p>}
      </aside>

      <div className="column">
        <div className="title-block" style={{ marginBottom: '1.1rem' }}>
          <h1 className="letter-initial">
            <img src={`/initials/${letter}.svg`} alt={letter} width="120" height="96" />
          </h1>
        </div>

        <FilterBar
          defs={SUBJECT_FILTERS}
          active={active}
          toggle={toggle}
          clear={clear}
          counts={counts}
          label="Filter motifs"
        />

        {!filtering ? (
          <ul className="tree">
            {roots.map((s) => (
              <Node key={s.id} data={data} subject={s} />
            ))}
          </ul>
        ) : matches.length === 0 ? (
          <p className="empty">
            No heading under {letter} matches every filter. Drop one, or try another letter.
          </p>
        ) : (
          <SubjectList data={data} subjects={matches} />
        )}
      </div>
    </div>
  )
}

function Node({ data, subject }) {
  const [open, setOpen] = useState(false)
  const kids = subject.children.map((id) => data.subjectById.get(id)).filter(Boolean)
  const total = useMemo(() => countRefs(data, subject), [data, subject])

  return (
    <li>
      <Link to={`/subject/${subject.id}`} className={subject.level === 0 ? 'lvl-0' : undefined}>
        {subject.heading}
      </Link>
      {total > 0 && (
        <span className="refs">
          {total} {total === 1 ? 'citation' : 'citations'}
        </span>
      )}
      {kids.length > 0 && (
        <>
          <button className="expander" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'hide' : `${kids.length} narrower`}
          </button>
          {open && (
            <ul>
              {kids.map((k) => (
                <Node key={k.id} data={data} subject={k} />
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  )
}

function countRefs(data, subject) {
  let total = 0
  const walk = (s) => {
    for (const r of s.references) total += r.folios.length
    for (const id of s.children) {
      const c = data.subjectById.get(id)
      if (c) walk(c)
    }
  }
  walk(subject)
  return total
}
