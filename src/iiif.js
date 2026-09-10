// Randall cites a folio; a IIIF manifest numbers canvases. iiif.json holds the
// mapping we resolved at build time. Everything here is a pure lookup.

const UV = 'https://universalviewer.dev/uv.html'

export function viewerUrl(manifestUrl, canvasIndex) {
  const base = `${UV}#?manifest=${encodeURIComponent(manifestUrl)}`
  return canvasIndex == null ? base : `${base}&cv=${canvasIndex}`
}

// Same rule the build script uses: a bare number is a recto.
function folioKeys(raw) {
  if (!raw) return []
  const first = String(raw).split(/[-–—]/)[0]
  const m = first.trim().toLowerCase().match(/^(\d+)\s*([rv])?/)
  if (!m) return []
  const n = String(parseInt(m[1], 10))
  return m[2] ? [`${n}${m[2]}`] : [`${n}r`, `${n}`]
}

// The whole-manuscript link, used when no folio is cited or none resolves.
export function manuscriptLink(entry) {
  if (!entry?.manifests?.length) return null
  const m = entry.manifests[0]
  return { url: viewerUrl(m.url), manifest: m, exact: false }
}

// The folio link. Returns null when the manuscript has no IIIF manifest at all,
// so callers render nothing rather than a link to a viewer that cannot open.
export function folioLink(entry, folio) {
  if (!entry?.manifests?.length) return null
  for (const key of folioKeys(folio)) {
    const hit = entry.folios[key]
    if (hit) {
      const [mi, cv] = hit
      const m = entry.manifests[mi]
      return { url: viewerUrl(m.url, cv), manifest: m, exact: true, canvas: cv }
    }
  }
  return manuscriptLink(entry)
}
