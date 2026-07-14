// Bundles each browser entry point (widgets, settings page) into a single
// self-contained ES module served statically by Homey. This replaces the
// former copy-based pipeline (shared helpers and vendored constants were
// duplicated into every widget) and inlines npm dependencies (Chart.js)
// so widgets work offline with versions pinned by the lockfile.
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { build } from 'esbuild'

const entryPoints = [
  'widgets/ata-group-setting/public/index.mts',
  'widgets/charts/public/index.mts',
  'settings/index.mts',
]

await Promise.all(
  entryPoints.map(async (entryPoint) =>
    build({
      bundle: true,
      entryPoints: [entryPoint],
      format: 'esm',
      legalComments: 'none',
      logLevel: 'info',
      minify: true,
      outfile: entryPoint.replace(/\.mts$/u, '.mjs'),
      target: ['es2020'],
    }),
  ),
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
  const references = [
    ...html.matchAll(
      /(?:href|src)="(?<file>[^":/][^":?]*)(?:\?v=[0-9a-f]+)?"/gu,
    ),
  ]
  let stamped = html
  for (const [reference, file] of references.map((match) => [
    match[0],
    match.groups.file,
  ])) {
    const attribute = reference.slice(0, reference.indexOf('='))
    stamped = stamped.replace(
      reference,
      `${attribute}="${file}?v=${await hashOf(path.join(directory, file))}"`,
    )
  }
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
