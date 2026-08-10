import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// The es2023 webview floor must cover every file a webview bundle can
// emit: the bundler's entry points plus every module they reach through
// a VALUE import — type imports erase at emit, so they pull nothing
// into a bundle. A reached file outside the floor globs would ship API
// the phone engines lack without any lint saying so; `types/widgets.mts`
// already ships `DAYS_MAX` into the charts bundle, which is why the
// floor names it. Inclusion is the invariant (globs cover whole
// directories by design), unlike melcloud-api's exact-list twin.

const ENTRY_POINT = /^ {2}'(?<file>[^']+\.mts)',$/gmv

const FLOOR_LIST = /webviewFloorFiles: \[(?<entries>[^\]]*)\]/gv

const FLOOR_ENTRY = /'(?<file>[^']+)'/gv

// One statement spans from `import` to its single `from` clause; the
// lazy quantifier stops at the first, so statements never bleed into
// each other even without semicolons.
const IMPORT_STATEMENT =
  /^import(?<typeOnly> type)? (?<clause>[\s\S]*?)from '(?<specifier>[^']+)'/gmv

const RELATIVE = /^\.\.?\//v

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))

const byName = (left: string, right: string): number =>
  left.localeCompare(right)

const readRepoFile = (relativePath: string): string =>
  readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')

// Globs escape their dots, park `**/` on a placeholder no glob can
// contain, expand `*`, then expand the parked `**/` — the order keeps
// the two star forms from consuming each other.
const toGlobRegex = (glob: string): RegExp =>
  new RegExp(
    `^${glob
      .replaceAll('.', String.raw`\.`)
      .replaceAll('**/', '\u{1}')
      .replaceAll('*', String.raw`[^\/]*`)
      .replaceAll('\u{1}', String.raw`(?:.*\/)?`)}$`,
    'v',
  )

// The repo-relative files a source file pulls in through value imports.
const getValueImports = (file: string): string[] =>
  readRepoFile(file)
    .matchAll(IMPORT_STATEMENT)
    .filter((statement) => statement.groups?.typeOnly === undefined)
    .map((statement) => statement.groups?.specifier)
    .filter(
      (specifier): specifier is string =>
        specifier !== undefined && RELATIVE.test(specifier),
    )
    .map((specifier) =>
      path
        .relative(
          REPO_ROOT,
          path.resolve(REPO_ROOT, path.dirname(file), specifier),
        )
        .replaceAll(path.sep, '/'),
    )
    .toArray()

const getEmittedClosure = (seed: readonly string[]): string[] => {
  const closure = new Set<string>()
  const pending = [...seed]
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (closure.has(file)) {
      continue
    }
    closure.add(file)
    pending.push(...getValueImports(file))
  }
  return [...closure].toSorted(byName)
}

describe.concurrent('webview floor closure', () => {
  const entryPoints = [
    ...new Set(
      readRepoFile('scripts/bundle.mts')
        .matchAll(ENTRY_POINT)
        .map((match) => match.groups?.file),
    ),
  ].filter((file) => file !== undefined)
  const floorRegexes = readRepoFile('eslint.config.ts')
    .matchAll(FLOOR_LIST)
    .flatMap((match) => (match.groups?.entries ?? '').matchAll(FLOOR_ENTRY))
    .map((match) => match.groups?.file)
    .filter((file) => file !== undefined)
    .map(toGlobRegex)
    .toArray()

  // Guards the guard: broken extractors would equal two empty sets.
  it('finds the entry points and the floor globs', () => {
    expect(entryPoints.length).toBeGreaterThan(2)
    expect(floorRegexes.length).toBeGreaterThan(2)
  })

  it('follows at least one value-import edge beyond the seed', () => {
    expect(getEmittedClosure(entryPoints).length).toBeGreaterThan(
      entryPoints.length,
    )
  })

  it('floors every file a webview bundle can emit', () => {
    const uncovered = getEmittedClosure(entryPoints).filter((file) =>
      floorRegexes.every((regex) => !regex.test(file)),
    )

    expect(uncovered).toStrictEqual([])
  })
})
