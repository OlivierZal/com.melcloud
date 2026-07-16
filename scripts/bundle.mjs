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

import { build } from 'esbuild'

// The IIFE global each page's inline `onHomeyReady` reads `start` from.
const GLOBAL_NAME = 'MELCloudWebview'

// The Homey CLI's packaging target: `tsc` already emits here (its
// validated `outDir`), and the CLI packs exactly this directory.
const OUT_ROOT = '.homeybuild'

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

const sharedOptions = {
  bundle: true,
  legalComments: 'none',
  logLevel: 'info',
  minify: true,
  target: ['es2020'],
}

await Promise.all(
  entryPoints.flatMap((entryPoint) => {
    const outBase = path.join(OUT_ROOT, entryPoint.replace(/\.mts$/u, ''))
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

// Courtesy cleanup: builds predating the `.homeybuild` emission left
// bundles in the source tree. The CLI would copy them into the package,
// where this build immediately overwrites them — harmless, but they
// linger confusingly in the working tree.
await Promise.all(
  entryPoints.flatMap((entryPoint) =>
    ['.js', '.mjs'].map(async (extension) =>
      rm(entryPoint.replace(/\.mts$/u, extension), { force: true }),
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
const hashOf = async (filePath) => {
  const content = await readFile(filePath)
  return createHash('sha256').update(content).digest('hex').slice(0, 8)
}

const stampHtml = async (htmlPath) => {
  let html = ''
  try {
    html = await readFile(htmlPath, 'utf8')
  } catch {
    return
  }
  const directory = path.dirname(htmlPath)
  // A local asset reference: an attribute value (href/src) or a dynamic
  // import specifier, with an optional existing stamp.
  const reference =
    /(href="|src="|import\('\.\/)([^"':?/][^"':?]*)(?:\?v=[0-9a-f]+)?(["')])/gu
  // Hash each referenced asset up front — the replace below is sync.
  const hashes = new Map()
  for (const [, , file] of html.matchAll(reference)) {
    if (!hashes.has(file)) {
      hashes.set(file, await hashOf(path.join(directory, file)))
    }
  }
  // Stamp only within a reference context, so the same filename written
  // elsewhere (e.g. a comment) is never rewritten.
  const stamped = html.replaceAll(
    reference,
    (_match, prefix, file, suffix) =>
      `${prefix}${file}?v=${hashes.get(file)}${suffix}`,
  )
  if (stamped !== html) {
    await writeFile(htmlPath, stamped)
  }
}

await Promise.all(
  pages.map(async (page) => stampHtml(path.join(OUT_ROOT, page))),
)
