// Shared helpers for turning IIIF canvas labels into folio deep-link tokens.

// Some libraries foliate in Roman numerals — Gallica labels fr. 25526 as
// "Ir", "Iv", … "LXXXVv" — and Randall occasionally cites them that way too.
// Strict form only: subtractive pairs, descending groups, no more than three
// repeats. Loose parsing would turn ordinary words into numbers.
const ROMAN = /^(m{0,4})(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i
const ROMAN_VALUES = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 }

export function romanToInt(raw) {
  const s = String(raw || '').toLowerCase()
  if (!s || !ROMAN.test(s)) return null
  let total = 0
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN_VALUES[s[i]]
    const next = ROMAN_VALUES[s[i + 1]]
    total += next > v ? -v : v
  }
  return total || null
}

// Randall cites folios as "109", "63v", "201v-202", "149v-151".
// A bare number means recto. Ranges resolve to their first member.
export function normalizeFolio(raw) {
  if (!raw) return null
  const first = String(raw).split(/[-–—]/)[0]
  const m = first.trim().toLowerCase().match(/^(\d+)\s*([rv])?/)
  if (!m) return null
  return { num: String(parseInt(m[1], 10)), side: m[2] || null }
}

// Candidate lookup keys for a cited folio, most specific first.
export function folioKeys(raw) {
  const f = normalizeFolio(raw)
  if (!f) return []
  return f.side ? [`${f.num}${f.side}`] : [`${f.num}r`, `${f.num}`]
}

// Pull every folio token out of one canvas label.
// "f. 051v - 052r" -> ["51v","52r"];  "70r (0143)" -> ["70r"];  "227v" -> ["227v"]
export function tokensFromLabel(label) {
  if (!label) return []
  let s = String(label).toLowerCase()
  s = s.replace(/\((\d{3,})\)/g, ' ')        // BSB scan counter "(0143)"
  s = s.replace(/\bff?ol?\.?\s*/g, ' ')       // "f.", "fol.", "ff."
  s = s.replace(/[_,;]/g, ' ')
  const out = []
  const re = /(?<![\w.])(\d{1,4})\s*([rv])?(?![\w])/g
  let m
  while ((m = re.exec(s))) {
    out.push({ num: String(parseInt(m[1], 10)), side: m[2] || null })
  }
  return out
}

// Roman foliation, decided across the whole manifest rather than label by label.
// "v" is both the numeral five and the verso mark, so a single label cannot be
// read in isolation: "Iv" is one-verso in a manifest that also contains "Ir",
// and four in one that does not. Gallica foliates fr. 25526 this way.
function romanTokens(labels) {
  const cleaned = labels.map((l) =>
    String(l ?? '').trim().toLowerCase().replace(/\bff?ol?\.?\s*/g, '')
  )
  // A recto mark is unambiguous — "r" is not a numeral — so its presence is what
  // tells us this manifest marks sides at all.
  const usesSides = cleaned.some((t) => {
    const p = t.match(/^([ivxlcdm]+)r$/)
    return p && romanToInt(p[1]) !== null
  })

  const out = cleaned.map((t) => {
    // With sides in play the trailing letter is the side, so it must be split
    // off before parsing: "iv" is one-verso here, not four.
    if (usesSides) {
      const withSide = t.match(/^([ivxlcdm]+)([rv])$/)
      if (withSide) {
        const n = romanToInt(withSide[1])
        if (n !== null) return [{ num: String(n), side: withSide[2] }]
      }
    }
    const n = romanToInt(t)
    return n === null ? [] : [{ num: String(n), side: null }]
  })

  // Guard: a real foliation only ever runs forwards. Anything else means the
  // labels are not folio numbers and reading them as such would link to the
  // wrong leaf.
  let last = 0
  let seen = 0
  for (const toks of out) {
    for (const t of toks) {
      const n = Number(t.num)
      if (n < last) return null
      last = n
      seen++
    }
  }
  return seen >= 10 ? out : null
}

export function canvasLabel(canvas) {
  const l = canvas.label
  if (l == null) return null
  if (typeof l === 'string') return l
  if (Array.isArray(l)) {
    const v = l[0]
    return typeof v === 'string' ? v : v?.['@value'] ?? null
  }
  if (typeof l === 'object') {
    const v = Object.values(l)[0]
    if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : null
    return typeof v === 'string' ? v : null
  }
  return null
}

export function manifestCanvases(doc) {
  if (Array.isArray(doc?.items)) return doc.items.filter((i) => (i.type || i['@type'] || '').includes('Canvas'))
  const seqs = doc?.sequences
  if (Array.isArray(seqs) && seqs[0]?.canvases) return seqs[0].canvases
  return []
}

// Build { foliated, canvasCount, folios: { token: canvasIndex } } for one manifest.
// A manifest counts as foliated only if some label carries an explicit recto/verso
// marker. Otherwise its bare numbers are image sequence numbers, not folios, and
// linking by folio would silently point at the wrong page.
export function indexManifest(doc) {
  const canvases = manifestCanvases(doc)
  const labels = canvases.map((c) => canvasLabel(c))
  let parsed = labels.map((l) => tokensFromLabel(l))
  let foliated = parsed.some((toks) => toks.some((t) => t.side))

  if (!foliated) {
    const roman = romanTokens(labels)
    if (roman) {
      parsed = roman
      foliated = roman.some((toks) => toks.some((t) => t.side))
    }
  }
  const folios = {}
  if (foliated) {
    parsed.forEach((toks, i) => {
      for (const t of toks) {
        if (!t.side) continue
        const key = `${t.num}${t.side}`
        if (!(key in folios)) folios[key] = i
      }
    })
  }
  return { foliated, canvasCount: canvases.length, folios }
}
