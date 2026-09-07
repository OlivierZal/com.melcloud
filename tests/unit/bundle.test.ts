import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The bundler is a top-level-await script working against the current
// directory (the Homey CLI runs it from the packaged app's root), so
// each test materializes a miniature app in a temp directory, moves
// there, and imports the script afresh. The stamping semantics it calls
// into are the kit's (`stampPackagedPages` from `@olivierzal/homey-kit/node`,
// pinned by the kit's own suite): what belongs here is the bundler's own
// wiring — a compat pair per entry, and the manifest key each packaged
// page is served under. The identity is read off the packaged page's
// own `?v=` stamps, the documented contract, never recomputed.
const initialDirectory = process.cwd()

// One source per entry, each with its own body: byte-distinct bundles
// give byte-distinct identities, so the manifest proves it maps every
// key to the right page rather than to a coincidence.
const entrySource = (name: string): string =>
  `export const start = (value?: string): string => value ?? '${name}'\n`

// One local reference per page, so the page's identity is that one
// stamp and the manifest entry must equal it verbatim.
const pageHtml =
  '<html><head><script defer src="index.js"></script></head></html>'

const STAMP = /\?v=(?<stamp>[^"]+)"/gv

// The entries the bundler declares, with the manifest key each page is
// served under (`GET /webview-hashes`).
const ENTRIES = [
  { directory: 'settings', entry: 'settings' },
  { directory: 'widgets/ata-group-setting/public', entry: 'ata-group-setting' },
  { directory: 'widgets/charts/public', entry: 'charts' },
]

// Cwd-relative on purpose: every test runs from inside its own temp
// app, exactly where the Homey CLI runs the script from.
const seedApp = async (): Promise<void> => {
  await Promise.all(
    ENTRIES.map(async ({ directory, entry }) => {
      await mkdir(directory, { recursive: true })
      await writeFile(path.join(directory, 'index.mts'), entrySource(entry))
    }),
  )
}

const seedPackagedPages = async (): Promise<void> => {
  await Promise.all(
    ENTRIES.map(async ({ directory }) => {
      const packaged = path.join('.homeybuild', directory)
      await mkdir(packaged, { recursive: true })
      await writeFile(path.join(packaged, 'index.html'), pageHtml)
    }),
  )
}

const runBundler = async (): Promise<void> => {
  vi.resetModules()
  await import('../../scripts/bundle.mts')
}

const packagedFile = async (relativePath: string): Promise<string> =>
  readFile(path.join('.homeybuild', relativePath), 'utf8')

// The stamps a packaged page carries, in document order.
const stampsOf = async (directory: string): Promise<string[]> => {
  const page = await packagedFile(path.join(directory, 'index.html'))
  return page
    .matchAll(STAMP)
    .map(({ groups }) => groups?.stamp)
    .filter((stamp) => stamp !== undefined)
    .toArray()
}

describe('bundle script', () => {
  let workDirectory = ''

  beforeEach(async () => {
    workDirectory = await mkdtemp(path.join(tmpdir(), 'bundle-'))
    process.chdir(workDirectory)
    await seedApp()
  })

  afterEach(async () => {
    process.chdir(initialDirectory)
    await rm(workDirectory, { force: true, recursive: true })
  })

  it.each(ENTRIES)(
    'should emit the compat pair of $entry into the packaged app',
    async ({ directory }) => {
      await runBundler()

      const iife = await packagedFile(path.join(directory, 'index.js'))
      const esm = await packagedFile(path.join(directory, 'index.mjs'))

      expect(iife).toContain('var MELCloudWebview')
      expect(iife).not.toContain('export')
      expect(esm).toContain('export')
      // es2020 target: nullish coalescing ships as-is, unlowered
      expect(iife).toContain('??')
    },
  )

  it('should serve every packaged page under its own manifest key', async () => {
    await seedPackagedPages()

    await runBundler()

    const identities = await Promise.all(
      ENTRIES.map(async ({ directory, entry }): Promise<[string, string[]]> => [
        entry,
        await stampsOf(directory),
      ]),
    )
    const manifest: unknown = JSON.parse(
      await packagedFile('webview-hashes.json'),
    )

    // One stamp per page, served verbatim under the page's own key.
    expect(manifest).toStrictEqual(
      Object.fromEntries(identities.map(([entry, [stamp]]) => [entry, stamp])),
    )

    // Byte-distinct bundles, byte-distinct identities: the mapping is to
    // the right page, not to a coincidence.
    const distinctIdentities = new Set(identities.map(([, [stamp]]) => stamp))

    expect(distinctIdentities.size).toBe(ENTRIES.length)
  })

  it('should stamp nothing in a standalone suite run', async () => {
    await runBundler()

    await expect(packagedFile('webview-hashes.json')).rejects.toThrow('ENOENT')
  })
})
