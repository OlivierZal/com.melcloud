// Bundles each browser entry point (widgets, settings page) into
// `.homeybuild`, the packaged app the Homey CLI assembles: the CLI
// copies the app first and only then runs `npm run build`, so anything
// emitted into the source tree lands too late to ship (the #1404 root
// cause). Outputs stay a compat pair per entry — index.js (IIFE) for
// the current classic-defer HTML, index.mjs (ESM) for cached ESM-era
// HTMLs — and npm dependencies (Chart.js) are inlined so widgets work
// offline with versions pinned by the lockfile.
import { createHash } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { type BuildOptions, build } from 'esbuild'

// The IIFE global each page's inline `onHomeyReady` reads `start` from.
const GLOBAL_NAME = 'MELCloudWebview'

// The Homey CLI's packaging target: `tsc` already emits here (its
// validated `outDir`), and the CLI packs exactly this directory.
const OUT_ROOT = '.homeybuild'

const HASH_LENGTH = 8

const entryPoints = [
  'widgets/ata-group-setting/public/index.mts',
  'widgets/charts/public/index.mts',
  'settings/index.mts',
]

const pages = [
  'settings/index.html',
  'widgets/ata-group-setting/public/index.html',
  'widgets/charts/public/index.html',
]

// A local asset reference — an href/src attribute value, with an
// optional existing stamp. (A dynamic-import alternative once lived
// here: dead since the classic-defer fix, no shipped HTML uses
// `import()` any more.)
const REFERENCE =
  /(?<prefix>href="|src=")(?<file>[^"':?\/][^"':?]*)(?:\?v=[0-9a-f]+)?(?<suffix>")/gv

const sharedOptions: BuildOptions = {
  bundle: true,
  legalComments: 'none',
  logLevel: 'info',
  minify: true,
  target: ['es2020'],
}

await Promise.all(
  entryPoints.flatMap((entryPoint) => {
    const outBase = path.join(OUT_ROOT, entryPoint.replace(/\.mts$/v, ''))
    return [
      build({
        ...sharedOptions,
        entryPoints: [entryPoint],
        format: 'iife',
        globalName: GLOBAL_NAME,
        outfile: `${outBase}.js`,
      }),
      build({
        ...sharedOptions,
        entryPoints: [entryPoint],
        format: 'esm',
        outfile: `${outBase}.mjs`,
      }),
    ]
  }),
)

// Remove stale source-tree bundles left by pre-`.homeybuild` builds.
await Promise.all(
  entryPoints.flatMap((entryPoint) =>
    ['.js', '.mjs'].map(async (extension) =>
      rm(
        entryPoint.replace(/\.mts$/v, () => extension),
        { force: true },
      ),
    ),
  ),
)

// Cache-bust the PACKAGED pages: phone webviews cache assets across app
// versions, so a content hash per file forces a refetch exactly when a
// file changes. The committed source HTML stays unstamped — `?v=` is a
// package-time transform of the `.homeybuild` copy, which exists in the
// CLI flow (its pre-process copy runs before `npm run build`) and is
// absent in a standalone suite run, which only proves the bundles
// compile.
const hashOf = async (filePath: string): Promise<string> => {
  const content = await readFile(filePath)
  return createHash('sha256')
    .update(content)
    .digest('hex')
    .slice(0, HASH_LENGTH)
}

const collectHashes = async (
  html: string,
  directory: string,
): Promise<ReadonlyMap<string, string>> => {
  const files = new Set<string>()
  for (const match of html.matchAll(REFERENCE)) {
    const { file = '' } = match.groups ?? {}
    if (file !== '') {
      files.add(file)
    }
  }
  return new Map(
    await Promise.all(
      [...files].map(async (file): Promise<[string, string]> => [
        file,
        await hashOf(path.join(directory, file)),
      ]),
    ),
  )
}

// Stamp only within a reference context, so the same filename written
// elsewhere (e.g. a comment) is never rewritten. Rebuilt cursor-wise
// rather than through a `replaceAll` callback, whose loosely typed rest
// arguments cannot carry the named groups safely.
const stampReferences = (
  html: string,
  hashes: ReadonlyMap<string, string>,
): string => {
  let stamped = ''
  let cursor = 0
  for (const match of html.matchAll(REFERENCE)) {
    const { file = '', prefix = '', suffix = '' } = match.groups ?? {}
    const hash = hashes.get(file) ?? ''
    stamped += `${html.slice(cursor, match.index)}${prefix}${file}?v=${hash}${suffix}`
    cursor = match.index + match[0].length
  }
  return stamped + html.slice(cursor)
}

const stampHtml = async (htmlPath: string): Promise<void> => {
  let html: string
  try {
    html = await readFile(htmlPath, 'utf8')
  } catch {
    // The page copy only exists in the CLI flow; a standalone suite run
    // has nothing to stamp.
    return
  }
  const stamped = stampReferences(
    html,
    await collectHashes(html, path.dirname(htmlPath)),
  )
  if (stamped !== html) {
    await writeFile(htmlPath, stamped)
  }
}

await Promise.all(
  pages.map(async (page) => stampHtml(path.join(OUT_ROOT, page))),
)
