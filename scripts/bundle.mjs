// Bundles each browser entry point (widgets, settings page) into a single
// self-contained CLASSIC script served statically by Homey, inlining npm
// dependencies (Chart.js) so widgets work offline with versions pinned by
// the lockfile. The output is an IIFE (format: 'iife', not 'esm') exposing
// `start` on a global, loaded via a plain `<script src>` — NOT an ES
// module. Module fetches (`import()` / `<script type=module>`) stall on a
// cold webview open against Homey's local origin (the #1404 spinner);
// classic resource fetches, like the page's stylesheet, load cold.
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { build } from 'esbuild'

// The IIFE global each page's inline `onHomeyReady` reads `start` from.
// One name is safe: every webview is its own document loading only its
// own bundle.
const GLOBAL_NAME = 'MELCloudWebview'

const entryPoints = [
  'widgets/ata-group-setting/public/index.mts',
  'widgets/charts/public/index.mts',
  'settings/index.mts',
]

const sharedOptions = {
  bundle: true,
  legalComments: 'none',
  logLevel: 'info',
  minify: true,
  target: ['es2020'],
}

// Each entry builds TWICE. Phone webviews cache the HTML itself across
// app versions (observed in the wild: a cached dynamic-import HTML
// requesting index.mjs?v=… against an app shipping only index.js → 404 →
// "Loading failed"), so previously-shipped bundle filenames are a compat
// contract: index.js serves the current classic-defer HTML, index.mjs
// keeps every cached ESM-era HTML working (their import('./index.mjs')
// finds the exported `start`). Never rename or drop a shipped bundle
// filename — add alongside instead.
await Promise.all(
  entryPoints.flatMap((entryPoint) => [
    build({
      ...sharedOptions,
      entryPoints: [entryPoint],
      format: 'iife',
      globalName: GLOBAL_NAME,
      outfile: entryPoint.replace(/\.mts$/u, '.js'),
    }),
    build({
      ...sharedOptions,
      entryPoints: [entryPoint],
      format: 'esm',
      outfile: entryPoint.replace(/\.mts$/u, '.mjs'),
    }),
  ]),
)

// Cache-bust the static references: the phone webviews cache assets
// across app versions, so a content hash per file forces a refetch
// exactly when a file changes (same mechanism as the extension app).
const hashOf = async (filePath) => {
  const content = await readFile(filePath)
  return createHash('sha256').update(content).digest('hex').slice(0, 8)
}

const stampHtml = async (htmlPath) => {
  const html = await readFile(htmlPath, 'utf8')
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
  [
    'settings/index.html',
    'widgets/ata-group-setting/public/index.html',
    'widgets/charts/public/index.html',
  ].map(stampHtml),
)
