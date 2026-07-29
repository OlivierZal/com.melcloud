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
// modules are bundled into both widgets). Paths are extracted from the
// sources — literal ones exactly, template-built ones by their fixed
// chunks — and checked against the declared table. The declaration half
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

// Everything below the SURFACES table is the shared guard, byte-identical
// in com.melcloud, com.heatzy and com.melcloud.extension — edit all three
// together. Only the table above differs: it names what each app exposes.

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

// Path-shaped template literals are swept wherever they are written,
// not just inside a call: a builder returning one of several templates
// puts them a function away from any verb, and they would otherwise be
// the only paths nothing checks.
const extractPathTemplates = (source: string): string[] =>
  stripComments(source)
    .matchAll(/`(?<template>\/[a-z][^`]*)`/gv)
    .map((match) => match.groups?.template ?? '')
    .toArray()

// The typed helpers carry the verb in their name; the boot beacon calls
// the raw SDK with the verb as its first argument. Reading the pair
// matters because eleven declared paths differ only by method —
// `/classic/sessions` alone is declared under POST, GET and DELETE. The
// helper name must be followed immediately by its generic or its paren,
// so the import list is not read as a call site. Template-built paths
// are swept separately below; a path passed as a variable stays out of
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

// Every PUT and DELETE call site builds its path from a template, so the
// literal sweeps above see none of them — the verbs carrying the whole
// settings surface would go unchecked. A template is still partly known
// at build time: its literal chunks are fixed and ordered, and only the
// `${…}` holes float (one may expand to nothing, as an optional query
// string does). Keeping the chunks and letting the holes float is enough
// to require that some declared route of the same method could serve the
// call, which is the pair check's whole point.
const HELPER_TEMPLATE_CALL =
  /homeyApi(?<verb>Get|Put|Post|Delete)(?:<[^\(\)]*>)?\(\s*[\w.#]+\s*,\s*`(?<template>[^`]*)`/gv

const escapeRegExp = (chunk: string): string =>
  chunk.replaceAll(/[$\(\)*+.?\[\\\]^\{\|\}]/gv, String.raw`\$&`)

// A hole can nest braces — `${new URLSearchParams({ … })}` does — so the
// literal chunks are found by tracking depth, not by a regex that would
// stop at the first inner `}`. `${` is folded to one sentinel first so
// the scan reads a single character per step.
const HOLE = ''

const toTemplateChunks = (template: string): string[] => {
  const chunks: string[] = []
  let literal = ''
  let depth = 0
  for (const char of template.replaceAll('${', '')) {
    if (char === HOLE) {
      if (depth === 0) {
        chunks.push(literal)
        literal = ''
      }
      depth += 1
    } else if (char === '{' && depth > 0) {
      depth += 1
    } else if (char === '}' && depth > 0) {
      depth -= 1
    } else if (depth === 0) {
      literal += char
    }
  }
  chunks.push(literal)
  return chunks
}

// Declared paths carry no query string, so anything from the first `?`
// of a literal chunk on is dropped — a `?` inside a hole is part of the
// hole and never reaches here.
const toTemplatePattern = (template: string): RegExp => {
  const chunks = toTemplateChunks(template)
  const queryIndex = chunks.findIndex((chunk) => chunk.includes('?'))
  const pathChunks =
    queryIndex === -1
      ? chunks
      : [
          ...chunks.slice(0, queryIndex),
          (chunks[queryIndex] ?? '').split('?', 1)[0] ?? '',
        ]
  return new RegExp(
    `^${pathChunks.map((chunk) => escapeRegExp(chunk)).join('.*')}$`,
    'v',
  )
}

interface TemplateCall {
  readonly method: string
  readonly pattern: RegExp
  readonly template: string
}

const extractTemplateCalls = (source: string): TemplateCall[] =>
  stripComments(source)
    .matchAll(HELPER_TEMPLATE_CALL)
    .map((match) => ({
      method: (match.groups?.verb ?? '').toUpperCase(),
      pattern: toTemplatePattern(match.groups?.template ?? ''),
      template: match.groups?.template ?? '',
    }))
    .toArray()

// Counting every helper call site, whatever shape its path takes, turns
// the sweeps above from "found something" into "found everything": a
// call the extractors cannot read shows up as a shortfall instead of
// passing unseen. A generic may wrap across lines, so newlines are
// allowed inside it.
const HELPER_CALL_SITE = /homeyApi(?:Get|Put|Post|Delete)(?:<[^\(\)]*>)?\s*\(/gv

// Some call sites hand over a path the site itself does not spell: a
// parameter on a list helper, or a builder returning one of several
// templates. Their verb is unreadable there, but every path they can
// produce is written somewhere in the same sources, which the sweep
// below reads. Counting them keeps the accounting complete instead of
// letting them vanish.
const HELPER_INDIRECT_CALL =
  /homeyApi(?:Get|Put|Post|Delete)(?:<[^\(\)]*>)?\(\s*[\w.#]+\s*,\s*[a-z]\w*/gv

const countMatches = (source: string, pattern: RegExp): number =>
  stripComments(source).matchAll(pattern).toArray().length

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
      const templates = sources.flatMap((source) =>
        extractPathTemplates(source),
      )
      const unmatched = [
        ...[...new Set(literals)].filter((literal) =>
          routes.every((route) => !routeMatches(route.path, literal)),
        ),
        ...[...new Set(templates)].filter((template) => {
          const pattern = toTemplatePattern(template)
          return routes.every((route) => !pattern.test(route.path))
        }),
      ]

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

    it('should declare a route of the same method for every template-built call', async () => {
      const routes = await readRoutes(manifest)
      const sources = await readSurfaceSources(sourceDirs)
      const calls = sources.flatMap((source) => extractTemplateCalls(source))
      const unmatched = calls
        .filter((call) =>
          routes.every(
            (route) =>
              route.method !== call.method || !call.pattern.test(route.path),
          ),
        )
        .map(({ method, template }) => `${method} ${template}`)

      expect(unmatched).toStrictEqual([])
    })

    // Both checks above pass vacuously on a call the extractors cannot
    // read, which is how the verb went unchecked in the first place.
    // Accounting for every call site — parsed, or handing over a path it
    // does not spell — turns that silence into a failure, and subsumes
    // any "the extractor still matches something" clause: a regex that
    // stopped matching leaves its calls counted here and nowhere else.
    it('should account for every helper call site in its own sources', async () => {
      const sources = await readSurfaceSources(sourceDirs)
      const callSites = sources.reduce(
        (total, source) => total + countMatches(source, HELPER_CALL_SITE),
        0,
      )
      const indirectCalls = sources.reduce(
        (total, source) => total + countMatches(source, HELPER_INDIRECT_CALL),
        0,
      )
      const parsed =
        sources.flatMap((source) => extractRouteCalls(source)).length +
        sources.flatMap((source) => extractTemplateCalls(source)).length

      expect(callSites).toBeGreaterThan(0)
      expect(parsed + indirectCalls).toBeGreaterThanOrEqual(callSites)
    })
  })
})
