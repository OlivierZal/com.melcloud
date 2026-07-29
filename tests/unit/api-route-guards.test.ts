import { readdir, readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

interface DeclaredRoute {
  readonly method: string
  readonly path: string
}

interface Surface {
  readonly manifest: string
  readonly name: string
  readonly sourceDirs: readonly string[]
}

// The call-site half of the API contract: webview sources may only call
// routes their own surface declares — the settings page hits the app
// API, each widget hits its own widget API (the shared `public/`
// modules are bundled into both widgets). Literal paths are extracted
// from the sources and checked against the declared table;
// template-built paths are out of scope by design. The declaration half
// (manifest ids ↔ handlers, both directions, type level) lives in
// tests/integration/api-contract.test.ts.
const SURFACES: readonly Surface[] = [
  {
    manifest: '.homeycompose/app.json',
    name: 'settings',
    sourceDirs: ['settings'],
  },
  {
    manifest: 'widgets/ata-group-setting/widget.compose.json',
    name: 'ata-group-setting widget',
    sourceDirs: ['widgets/ata-group-setting/public', 'public'],
  },
  {
    manifest: 'widgets/charts/widget.compose.json',
    name: 'charts widget',
    sourceDirs: ['widgets/charts/public', 'public'],
  },
]

const readRoutes = async (manifestPath: string): Promise<DeclaredRoute[]> => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    api?: Record<string, DeclaredRoute>
  }
  return Object.values(manifest.api ?? {})
}

const listSourceFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir)
  return entries
    .filter((entry) => entry.endsWith('.mts') || entry.endsWith('.html'))
    .map((entry) => `${dir}/${entry}`)
}

// Comment lines are dropped so a path mentioned in prose is not read as
// a call site.
const stripComments = (source: string): string =>
  source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart()
      return (
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('*') &&
        !trimmed.startsWith('/*')
      )
    })
    .join('\n')

const extractPathLiterals = (source: string): string[] =>
  stripComments(source)
    .matchAll(/['"](?<path>\/[a-z][\w\-\/]*)['"]/gv)
    .map((match) => match.groups?.path ?? '')
    .toArray()

// The typed helpers carry the verb in their name; the boot beacon calls
// the raw SDK with the verb as its first argument. Reading the pair
// matters because eleven declared paths differ only by method —
// `/classic/sessions` alone is declared under POST, GET and DELETE. The
// helper name must be followed immediately by its generic or its paren,
// so the import list is not read as a call site. Template-built paths
// (`/${api}/sessions`) and paths passed as a variable stay out of
// scope, exactly as for the bare-path sweep above.
const HELPER_CALL =
  /homeyApi(?<verb>Get|Put|Post|Delete)(?:<[^\(\)]*>)?\(\s*[\w.#]+\s*,\s*['"](?<path>\/[a-z][\w\-\/]*)['"]/gv
const SDK_CALL =
  /homey\.api\(\s*['"](?<verb>[A-Z]+)['"]\s*,\s*['"](?<path>\/[a-z][\w\-\/]*)['"]/gv

const extractRouteCalls = (source: string): DeclaredRoute[] => {
  const stripped = stripComments(source)
  return [
    ...stripped.matchAll(HELPER_CALL).map((match) => ({
      method: (match.groups?.verb ?? '').toUpperCase(),
      path: match.groups?.path ?? '',
    })),
    ...stripped.matchAll(SDK_CALL).map((match) => ({
      method: match.groups?.verb ?? '',
      path: match.groups?.path ?? '',
    })),
  ]
}

const dedupeCalls = (calls: DeclaredRoute[]): DeclaredRoute[] => {
  const byPair = new Map<string, DeclaredRoute>()
  for (const call of calls) {
    byPair.set(`${call.method} ${call.path}`, call)
  }
  return byPair.values().toArray()
}

const routeMatches = (routePath: string, literal: string): boolean => {
  const routeSegments = routePath.split('/')
  const literalSegments = literal.split('/')
  return (
    routeSegments.length === literalSegments.length &&
    routeSegments.every(
      (segment, index) =>
        segment.startsWith(':') || segment === literalSegments[index],
    )
  )
}

const readSurfaceSources = async (
  sourceDirs: readonly string[],
): Promise<string[]> => {
  const fileGroups = await Promise.all(
    sourceDirs.map(async (dir) => listSourceFiles(dir)),
  )
  return Promise.all(
    fileGroups.flat().map(async (file) => readFile(file, 'utf8')),
  )
}

describe('api route guards', () => {
  describe.each(SURFACES)('$name', ({ manifest, sourceDirs }) => {
    it('should declare every path its webview sources call', async () => {
      const routes = await readRoutes(manifest)
      const sources = await readSurfaceSources(sourceDirs)
      const literals = sources.flatMap((source) => extractPathLiterals(source))
      const unmatched = [...new Set(literals)].filter((literal) =>
        routes.every((route) => !routeMatches(route.path, literal)),
      )

      expect(unmatched).toStrictEqual([])
    })

    it('should declare every method its webview sources call each path with', async () => {
      const routes = await readRoutes(manifest)
      const sources = await readSurfaceSources(sourceDirs)
      const calls = sources.flatMap((source) => extractRouteCalls(source))
      const unmatched = dedupeCalls(calls).filter((call) =>
        routes.every(
          (route) =>
            route.method !== call.method ||
            !routeMatches(route.path, call.path),
        ),
      )

      expect(unmatched).toStrictEqual([])
    })
  })

  // The pair check above would pass vacuously if its regex stopped
  // matching, which is exactly how the verb went unchecked in the first
  // place. Pinning that several distinct methods are recovered proves
  // the extractor still reads both halves.
  it('should recover several distinct methods from the call sites', async () => {
    const sources = await Promise.all(
      SURFACES.map(async ({ sourceDirs }) => readSurfaceSources(sourceDirs)),
    )
    const calls = sources.flat().flatMap((source) => extractRouteCalls(source))
    const methods = new Set(calls.map(({ method }) => method))

    expect(methods.size).toBeGreaterThan(1)
  })
})
