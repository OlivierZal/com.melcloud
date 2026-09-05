import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import {
  analyzeWebviewFloor,
  getQuotedEntries,
} from '@olivierzal/homey-kit/testing'
import { describe, expect, it } from 'vitest'

// The es2023 webview floor must cover every file a webview bundle can
// emit: the bundler's entry points plus every module they reach through
// a VALUE import — type imports erase at emit, so they pull nothing
// into a bundle. A reached file outside the floor globs would ship API
// the phone engines lack without any lint saying so; `types/widgets.mts`
// already ships `DAYS_MAX` into the charts bundle, which is why the
// floor names it. Inclusion is the invariant (globs cover whole
// directories by design), unlike melcloud-api's exact-list twin. The
// closure walk and the glob matching are the kit's
// (`analyzeWebviewFloor`); what stays here is this app's perimeter, read
// from its own config files, and the assertions over the findings.

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))

const readRepoFile = (relativePath: string): string =>
  readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')

describe.concurrent('webview floor closure', () => {
  const entryPoints = getQuotedEntries(
    readRepoFile('scripts/bundle.mts'),
    'entryPoints',
  )
  const floorGlobs = getQuotedEntries(
    readRepoFile('eslint.config.ts'),
    'webviewFloorFiles',
  )
  const findings = analyzeWebviewFloor({
    entryPoints,
    floorGlobs,
    repoRoot: REPO_ROOT,
  })

  // Guards the guard: the kit only refuses an EMPTY sweep, while this
  // app declares three entry points and four globs — a perimeter read
  // that lost most of them would still pass the kit's check.
  it('reads more than two entry points and more than two floor globs', () => {
    expect(entryPoints.length).toBeGreaterThan(2)
    expect(floorGlobs.length).toBeGreaterThan(2)
  })

  // Guards the walk: one that silently stopped at the seed would floor
  // nothing beyond the entry points themselves.
  it('follows at least one value-import edge beyond the seed', () => {
    expect(findings.closure.length).toBeGreaterThan(entryPoints.length)
  })

  it('floors every file a webview bundle can emit', () => {
    expect(findings.uncovered).toStrictEqual([])
  })
})
