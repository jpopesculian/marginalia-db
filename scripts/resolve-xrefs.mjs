// Randall's "see" and "see also" targets are written for a reader holding the
// book, not for a machine. They lean on the entry you are already looking at,
// they abbreviate, and they quote only the opening words of a long heading.
// This resolves them to subject ids once, at build time, so the app only ever
// renders a link it knows leads somewhere.
//
// Precision beats coverage: a wrong "see" link sends a reader to the wrong
// motif, which is worse than plain text. Every strategy below is either an
// exact match or is scoped tightly enough to be unambiguous.

const norm = (x) =>
  x.toLowerCase().replace(/[^a-z0-9: ]+/g, ' ').replace(/\s+/g, ' ').trim()

// Headings carry parenthetical glosses. Some are never closed — the printed
// index runs them to the end of the entry — so strip both forms.
const bare = (h) =>
  h.replace(/\s*\([^)]*\)/g, ' ').replace(/\s*\([^)]*$/, ' ').replace(/\s+/g, ' ').trim()

// "Abacus see Man with" means "Man with abacus": the target trails off and the
// entry you are reading completes it.
const DANGLING =
  /\b(and|with|as|of|in|on|to|by|before|behind|under|over|for|from|at|into|holding|carrying|attacked|pursued|ridden|played)$/i

export function buildResolver(subjects) {
  // Shallower headings win. Three subjects are called "Ape with fruit"; the
  // top-level one is what a cross-reference means.
  const ordered = [...subjects].sort((a, b) => a.level - b.level)

  const exact = new Map()
  const add = (key, id) => {
    const k = norm(key)
    if (k && !exact.has(k)) exact.set(k, id)
  }
  for (const s of ordered) add(s.path.join(': '), s.id)
  for (const s of ordered) add(bare(s.path.map(bare).join(': ')), s.id)
  for (const s of ordered) {
    add(s.heading, s.id)
    add(bare(s.heading), s.id)
    if (s.path.length >= 2) add(s.path.slice(-2).map(bare).join(': '), s.id)
  }

  const headingKey = new Map()
  for (const s of ordered) {
    const k = norm(bare(s.heading))
    if (k && !headingKey.has(k)) headingKey.set(k, s)
  }
  const headingKeys = [...headingKey.keys()]

  const rootByKey = new Map()
  for (const s of ordered) {
    if (s.level !== 0) continue
    for (const k of [norm(s.heading), norm(bare(s.heading))]) if (k && !rootByKey.has(k)) rootByKey.set(k, s)
  }

  const descendants = new Map()
  for (const s of subjects) {
    if (!descendants.has(s.path[0])) descendants.set(s.path[0], [])
    descendants.get(s.path[0]).push(s)
  }

  return function resolve(target, source) {
    const id = match(target, source)
    // A cross-reference onto the entry you are already reading is not a link.
    return id && id !== source.id ? id : null
  }

  function match(target, source) {
    const t = String(target || '').trim()
    if (!t) return null
    let id

    if ((id = exact.get(norm(t)))) return id
    if ((id = exact.get(norm(bare(t))))) return id

    // "Avarice, references under" simply points at Avarice.
    const under = t.match(/^(.*?),?\s*references? under$/i)
    if (under && (id = exact.get(norm(under[1])))) return id

    const tails = [source.heading, source.heading.toLowerCase(), source.path[source.path.length - 1]]
    if (DANGLING.test(t)) {
      for (const tail of tails) if ((id = exact.get(norm(`${t} ${tail}`)))) return id
    }

    // "David, life of: D. and" -> root "David, life of", remainder "D. and",
    // the initial expanded from the root, then completed by the entry itself.
    if (t.includes(':')) {
      const cut = t.indexOf(':')
      const root = rootByKey.get(norm(t.slice(0, cut))) || rootByKey.get(norm(bare(t.slice(0, cut))))
      if (root) {
        let rest = t.slice(cut + 1).trim()
        const firstWord = root.heading.split(/[\s,(]/)[0]
        rest = rest.replace(/^([A-Z])\.(?=\s|$)/, (m, i) =>
          firstWord[0]?.toUpperCase() === i ? firstWord : m
        )
        const pool = descendants.get(root.path[0]) || []
        const want = new Set([norm(rest), norm(bare(rest))])
        const completed = DANGLING.test(rest)
          ? new Set(tails.map((tail) => norm(`${rest} ${tail}`)))
          : new Set()
        for (const cand of pool) {
          const keys = [norm(cand.heading), norm(bare(cand.heading))]
          if (keys.some((k) => want.has(k))) return cand.id
          if (completed.size && keys.some((k) => completed.has(k))) return cand.id
        }
        const prefix = norm(bare(rest))
        if (prefix.length >= 4) {
          const opens = pool.filter((c) => norm(bare(c.heading)).startsWith(prefix + ' '))
          if (opens.length === 1) return opens[0].id
        }
      }
    }

    // "Man and pigs" quoting the start of "Man and pigs, beating down acorns…".
    const key = norm(bare(t))
    if (key.length >= 6) {
      const opens = headingKeys.filter((h) => h.startsWith(key + ' '))
      if (opens.length === 1) return headingKey.get(opens[0]).id
      if (opens.length > 1) {
        const src = norm(source.heading)
        const named = opens.filter((h) => h.includes(src))
        if (named.length === 1) return headingKey.get(named[0]).id
      }
    }
    return null
  }
}
