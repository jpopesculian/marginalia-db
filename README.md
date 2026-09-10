# Marginalia

A web front end for Lilian M. C. Randall's *Images in the Margins of Gothic
Manuscripts* — 8,895 indexed motifs, 232 manuscripts, and 741 plates — with
links through to the digitised leaf wherever a holding library publishes one.

## Running it

```sh
npm install
npm run dev        # http://localhost:8090
```

`npm run dev` rebuilds `public/data` from `database/` first, so the app always
serves what is currently in the raw files.

The dev server binds every interface and accepts any `*.ts.net` hostname, so it
is reachable over Tailscale. That also exposes port 8090 on every other
interface, including any public IP the machine has. Narrow `server.host` in
`vite.config.js` if that matters.

## How the folio links work

Randall cites a leaf (`f. 63v`). A IIIF manifest numbers canvases. Bridging the
two is the only non-obvious part of this project.

None of the holding libraries send CORS headers on their manifests, so the
browser cannot resolve a folio at runtime. `scripts/harvest-iiif.mjs` fetches all
151 manifests named in `database/digitized.json` server-side and writes
`database/iiif_index.json`, a map from folio token to canvas index. That file is
cached; re-running only refetches manifests that are missing or errored.

A manifest counts as **foliated** only when at least one canvas label carries an
explicit recto or verso marker. Providers that label canvases `Page 204`,
`Seq. 322`, or `View 398` are numbering images, not naming leaves — guessing an
offset would link confidently to the wrong page, so those manuscripts get a
manuscript-level link and the interface says why.

| | |
|---|---|
| Manifests indexed | 149 of 151 |
| Manifests with folio labels | 95 |
| Manuscripts openable | 126 of 232 |
| Citations that open the exact leaf | 3,859 of 13,200 |

Links open the [Universal Viewer](https://universalviewer.dev) with the manifest
and, where resolved, a `cv` canvas index.

Two Trinity College Cambridge manifests serve HTML rather than JSON upstream and
are recorded as errors.

## The display font

**Grenze Gotisch** (Google Fonts, variable 300–700) sets the wordmark and the
home page hero — the two places that are pure identity. It is a modernised
gothic rather than a true textura, so it carries the period without the
illegibility. Page titles, section headings, body text and all apparatus are
Spectral: those are things to read, not things to look at.

The **alphabet capitals** on the Motifs page are drawn artwork, not a webfont.
`public/initials/A.svg` … `Z.svg` are committed here, ~10 KB each, and a page
loads exactly one. Every letter shares a single viewBox height — the union of
all 26 ink bounds — so setting the height alone keeps them the same visual size
while each keeps its own width, tails and flourishes included.

They were traced once from **Kingfall Initials** with `npm run initials`. That is
the only thing the licensed font is needed for, so it lives in `./fonts`, outside
`publicDir`, and is gitignored:

```sh
npm run fonts ~/Downloads/Kingfall   # only to regenerate
npm run initials
```

Keeping it out of `publicDir` matters. Anything under `public/` is copied into
`dist/` at build time, so a font left there would be redistributed with every
deploy — which the Kingfall EULA forbids. The EULA does permit distributing
artwork created with the font, which is what the SVGs are.

Nothing at runtime touches the font. Clone the repo without it and the capitals
still render.

## Filters

The Motifs, Search and Manuscripts pages carry toggle filters. They multi-select,
combine with AND, and live in the query string as `?f=plate,folio`, so a filtered
view survives letter navigation and can be shared as a link. Counts on each
toggle describe the current scope — the selected letter, the current query, or
the current city and text search — not the whole database.

| Filter | Applies to | Meaning |
|---|---|---|
| With a plate | motifs | Reproduced in one of the 741 photographic plates |
| Opens a folio | motifs | At least one citation resolves to a real canvas |
| Cited in a manuscript | motifs | Has citations of its own, rather than only pointing elsewhere |
| Images online | manuscripts | The holding library publishes a IIIF manifest |
| Folio links | manuscripts | That manifest names its leaves |
| With plates | manuscripts | Reproduced in at least one plate |

There is deliberately no literal "with a folio" filter: only 15 of 13,200
citations lack a folio value, so it would filter nothing. *Opens a folio* carries
that intent instead.

Filtering the Motifs page flattens the hierarchy — narrower headings are what
usually carry the plates, and they are invisible while the tree is collapsed.

## Scripts

| Command | What it does |
|---|---|
| `npm run harvest` | Fetch IIIF manifests and rebuild the folio index. Network-bound; safe to re-run. |
| `npm run prepare-data` | Rebuild `public/data` from `database/` and the folio index. |
| `npm run verify-links` | Sample resolved citations, refetch each manifest, and confirm the linked canvas really carries the cited folio. |
| `npm run fonts <path>` | Copy licensed Kingfall files into `./fonts`. Only needed to regenerate the capitals. |
| `npm run initials` | Trace the alphabet capitals from that font into `public/initials`. |
| `npm run build` | Production build into `dist/`. |

`verify-links` is the check that matters: it is the only thing standing between a
correct deep link and a plausible-looking wrong one. It currently passes 22/22
across eight providers.

## Layout

```
database/          raw JSON, plus the harvested iiif_index.json
figures/           741 plate photographs
fonts/             licensed Kingfall source — gitignored, regeneration only
scripts/           data pipeline, link verifier, initial tracer
public/initials/   the 26 drawn capitals — committed
public/data/       generated — do not edit
src/               the app
```

`public/figures` is a symlink to `figures/` so the 70 MB of plates are not
duplicated.
