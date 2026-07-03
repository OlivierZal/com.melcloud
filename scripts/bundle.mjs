// Bundles each browser entry point (widgets, settings page) into a single
// self-contained ES module served statically by Homey. This replaces the
// former copy-based pipeline (shared helpers and vendored constants were
// duplicated into every widget) and inlines npm dependencies (ApexCharts)
// so widgets work offline with versions pinned by the lockfile.
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
