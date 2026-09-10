// Shared helpers for turning IIIF canvas labels into folio deep-link tokens.

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
  const parsed = canvases.map((c) => tokensFromLabel(canvasLabel(c)))
  const foliated = parsed.some((toks) => toks.some((t) => t.side))
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
