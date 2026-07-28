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

describe('api route guards', () => {
  describe.each(SURFACES)('$name', ({ manifest, sourceDirs }) => {
    it('should declare every path its webview sources call', async () => {
      const routes = await readRoutes(manifest)
      const fileGroups = await Promise.all(
        sourceDirs.map(async (dir) => listSourceFiles(dir)),
      )
      const sources = await Promise.all(
        fileGroups.flat().map(async (file) => readFile(file, 'utf8')),
      )
      const literals = sources.flatMap((source) => extractPathLiterals(source))
      const unmatched = [...new Set(literals)].filter((literal) =>
        routes.every((route) => !routeMatches(route.path, literal)),
      )

      expect(unmatched).toStrictEqual([])
    })
  })
})
