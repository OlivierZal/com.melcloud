// Bundles each browser entry point (widgets, settings page) into
// `.homeybuild`, the packaged app the Homey CLI assembles: the CLI
// copies the app first and only then runs `npm run build`, so anything
// emitted into the source tree lands too late to ship (the #1404 root
// cause). Outputs stay a compat pair per entry — index.js (IIFE) for
// the current classic-defer HTML, index.mjs (ESM) for cached ESM-era
// HTMLs — and npm dependencies (Chart.js) are inlined so widgets work
// offline with versions pinned by the lockfile.
import path from 'node:path'

import { type BuildOptions, build } from 'esbuild'

import { stampPackagedPages } from './webview-stamp.mts'

// The IIFE global each page's inline `onHomeyReady` reads `start` from.
const GLOBAL_NAME = 'MELCloudWebview'

// esbuild runs its build in a service process with its own working
// directory, while the stamping pass reads and writes through `node:fs`
// (the launcher's cwd): both are anchored at the repo root so they
// cannot disagree about where the packaged app lives.
const ROOT = path.resolve(import.meta.dirname, '..')

// The Homey CLI's packaging target: `tsc` already emits here (its
// validated `outDir`), and the CLI packs exactly this directory.
const OUT_ROOT = path.join(ROOT, '.homeybuild')

const entryPoints = [
  'widgets/ata-group-setting/public/index.mts',
  'widgets/charts/public/index.mts',
  'settings/index.mts',
]

// The packaged pages, each with the manifest key under which the app
// serves its bundle hash (`GET /webview-hashes`): a booted page compares
// its own `?v=` against the live value and reloads itself once when the
// webview cache served a stale copy.
const pages = [
  { entry: 'settings', page: 'settings/index.html' },
  {
    entry: 'ata-group-setting',
    page: 'widgets/ata-group-setting/public/index.html',
  },
  { entry: 'charts', page: 'widgets/charts/public/index.html' },
]

const sharedOptions: BuildOptions = {
  absWorkingDir: ROOT,
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

await stampPackagedPages(OUT_ROOT, pages)
