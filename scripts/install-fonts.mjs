// Copies the licensed Kingfall web fonts into ./fonts.
//
// Nothing at runtime loads them: the alphabet capitals ship as SVG artwork in
// public/initials. The font is only needed to regenerate that artwork, so it
// lives outside publicDir (a build would otherwise copy it into dist and a
// deploy would redistribute it) and is gitignored.
//
//   node scripts/install-fonts.mjs ~/Downloads/Kingfall
//   npm run initials
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const DEST = join(ROOT, 'fonts')
const source = resolve(
  (process.argv[2] || join(homedir(), 'Downloads', 'Kingfall')).replace(/^~/, homedir())
)

async function walk(dir) {
  const out = []
  for (const name of await readdir(dir)) {
    const full = join(dir, name)
    if ((await stat(full)).isDirectory()) out.push(...(await walk(full)))
    else if (/\.woff2?$/i.test(name)) out.push(full)
  }
  return out
}

try {
  await stat(source)
} catch {
  console.error(`No font source at ${source}`)
  console.error('Pass the unpacked Kingfall folder: node scripts/install-fonts.mjs <path>')
  process.exit(1)
}

const files = await walk(source)
if (!files.length) {
  console.error(`No .woff or .woff2 files under ${source}`)
  process.exit(1)
}

await mkdir(DEST, { recursive: true })
for (const file of files) await copyFile(file, join(DEST, basename(file)))
console.log(`installed ${files.length} font files into ./fonts`)
