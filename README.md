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

The home page paints from a shell of `meta`, `manuscripts` and `figures` — about
99 KB gzipped — rather than waiting for the 582 KB heading index. Every request
starts at the same moment; only the resolving is staged. Pages that read headings
still wait for the index.

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
| Manifests indexed | 151 of 151 |
| Manifests with folio labels | 98 |
| Manuscripts openable | 126 of 232 |
| Citations that open the exact leaf | 5,533 of 13,200 |
| Verified foliation offsets | 11 |

Most labels are Arabic, but Gallica foliates some manuscripts in Roman — `Ir`,
`Iv`, … `CLXIIIv`. Those are read per manifest rather than per label, because
`v` is both the numeral five and the verso mark: `Iv` is one-verso in a manifest
that also contains `Ir`, and four in one that does not. The resulting sequence
must run forwards or the manifest is rejected, since labels that are not really
folios would otherwise link to the wrong leaf.

Where the remaining citations go unlinked:

| Reason | Manifests |
|---|---|
| Labels are image counters — "Page 204", "Seq. 322", "View 398", plain "1" | 42 |
| Labels carry no folio at all — "NP", an empty "f.", a title | 7 |
| Roman foliation | fixed |

### Image counters

An image counter is not a folio, but for a straightforwardly scanned book the two
are related by

```
canvas = 2 * folio + (verso ? 1 : 0) + offset
```

where the offset counts the covers and flyleaves shot before f.1r. Nothing in the
manifest states it, so each offset in `database/foliation.json` was read off the
foliation pencilled on the leaf itself and then confirmed at a second leaf far
enough away that any unnumbered insert between them would have shifted it.

```sh
npm run foliation-probe "W. 88" 60 392
```

fetches the upper corner of those canvases so the number can be read.

Add an entry only with two confirmed checks, far enough apart to span the cited
range. A wrong offset mislinks every folio in the manuscript silently, which is
far worse than no link.

That guard earns its keep. Every manuscript under `_rejected` failed it for a
different reason:

- **BBR 10607** reads as offset 2 at f.99 and offset 4 at f.239. An unnumbered
  leaf between them means no single offset is right.
- **Princeton 44-18** holds 795 canvases for 205 folios, nearly four per leaf,
  because the scan includes detail shots. A fixed stride cannot describe it.

Eleven other sequence-only manifests hold fewer canvases than twice their highest
cited folio, so they are partial scans rather than whole books.

Two things make the corner hard to find, and both cost me a wrong conclusion
before I spotted them:

- **Read at the image's native size** — `region/full`, no upscaling — not from a
  downscaled page. Jacquemart 1 looked unreadable at 1500px wide and was
  perfectly legible cropped at full resolution.
- **Foliation is written on rectos.** If the offset is odd, even canvases are
  versos with a blank corner. St. Omer 5 has offset 5: canvas 300 shows nothing,
  canvas 301 reads 148. A blank corner means try the next canvas, not that the
  manuscript is unfoliated.

The ratio of canvases to highest cited folio is a cheap first filter: close to
2.0 means a plain front-to-back scan, and much above that means detail shots or
inserts worth checking before spending fetches.

`npm run verify-links` skips manuscripts that use an offset: their canvas labels
carry no folio, which is why they needed an offset in the first place. The leaf
photographs recorded in `checks` are their verification.

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

## Cross-references

Randall's "see" and "see also" targets are written for a reader holding the book.
They lean on the entry you are already reading ("Abacus see Man with" means "Man
with abacus"), they abbreviate ("David, life of: D. and"), they quote only the
opening words of a long heading, and they say things like "Tumbler, references
under". Matching them literally resolves about a third.

`scripts/resolve-xrefs.mjs` decodes those conventions once at build time, so the
app only ever renders a link it knows leads somewhere. Unresolved targets stay as
plain text.

| | Targets |
|---|---|
| Total | 5,117 |
| Resolved | 3,332 |
| Entries where at least one now links | 1,602 of 2,181 |

Precision is the constraint, not coverage: a wrong "see" link sends a reader to
the wrong motif, which is worse than no link. Every strategy is an exact match or
is scoped tightly enough to be unambiguous, shallower headings win ties — three
subjects are called "Ape with fruit" and the top-level one is what a reference
means — and a target that resolves onto its own entry is dropped.

## Filters

One filter set, held in the query string as `?f=plate,folio`, shared by every
page that lists things: Motifs, Search, subject pages, the manuscript list and
manuscript pages. Internal links carry it, so a filtered browse stays filtered as
you move between headings, manuscripts and back. Top-level navigation does not
carry it — switching section starts clean.

Filters multi-select and combine with AND. Counts on each toggle describe the
current scope: the selected letter, the current query, the current city, or the
citations on the page you are reading.

A shared key means the same thing everywhere; it is simply evaluated at whatever
grain the page shows.

| Key | Manuscript | Heading | Citation |
|---|---|---|---|
| `plate` | reproduced in a plate | reproduced in a plate | this citation is |
| `folio` | ≥1 cited folio opens the exact leaf | ≥1 citation opens the exact leaf | this one opens it |
| `online` | publishes a IIIF manifest | — | — |
| `cited` | — | has citations of its own | — |

Each bar offers only the keys that discriminate on that page. `cited` is absent
from citation lists because every citation is one; `online` is absent from
citation lists because every citation on a manuscript page shares that
manuscript's answer. A key carried in that a page does not offer changes nothing
and can still be cleared.

`folio` is deliberately about *cited* folios, not about the manifest. Thirteen
manuscripts publish a manifest that names leaves this index never cites; counting
those would promise a folio link and then open nothing.

A filtered page never hides the record. A subject page keeps the full printed
index entry above its citations, headings read "Where it is drawn (19 of 72)",
and clearing is one click.

There is deliberately no literal "with a folio" filter: only 15 of 13,200
citations lack a folio value, so it would filter nothing.

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
