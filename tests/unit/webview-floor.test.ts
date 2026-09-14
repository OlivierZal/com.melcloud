import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'

import {
  entryPoints,
  webviewFloorFiles,
} from '../../scripts/webview-perimeter.mts'

// The es2023 webview floor must cover every file a webview bundle
// emits: a reached file outside the floor globs would ship API the
// phone engines lack without any lint saying so. The bundler is the
// authority on what it emits, so its metafile — the real entry points,
// bundled in memory — is the measurement; a text walk of the import
// graph could only approximate it. Modules the bundles pull in from
// `node_modules` are out of scope: the kit floors its own webview
// modules through its own lint.

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))

const isFloored = (input: string): boolean =>
  webviewFloorFiles.some((glob) => path.matchesGlob(input, glob))

describe('webview floor closure', () => {
  it('floors every file a webview bundle emits', async () => {
    const { metafile } = await build({
      absWorkingDir: REPO_ROOT,
      bundle: true,
      entryPoints: [...entryPoints],
      format: 'esm',
      logLevel: 'silent',
      metafile: true,
      outdir: 'unused',
      write: false,
    })
    const inputs = Object.keys(metafile.inputs).filter(
      (input) => !input.startsWith('node_modules/'),
    )

    // `types/widgets.mts` reaches the charts bundle through a value
    // import, so a measurement that saw only the entry points would be
    // a broken one.
    expect(inputs.length).toBeGreaterThan(entryPoints.length)
    expect(inputs.filter((input) => !isFloored(input))).toStrictEqual([])
  })
})
