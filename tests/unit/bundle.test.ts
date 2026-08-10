import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The bundler is a top-level-await script working against the current
// directory (the Homey CLI runs it from the packaged app's root), so
// each test materializes a miniature app in a temp directory, moves
// there, and imports the script afresh. The stamping semantics it calls
// into are pinned separately, in tests/unit/webview-stamp.test.ts: what
// belongs here is the bundler's own wiring — a compat pair per entry,
// and the manifest key each packaged page is served under.
const HASH_LENGTH = 8

const initialDirectory = process.cwd()

// One source per entry, each with its own body: byte-distinct bundles
// give byte-distinct identities, so the manifest proves it maps every
// key to the right page rather than to a coincidence.
const entrySource = (name: string): string =>
  `export const start = (value?: string): string => value ?? '${name}'\n`

const pageHtml =
  '<html><head><script defer src="index.js"></script></head></html>'

// The entries the bundler declares, with the manifest key each page is
// served under (`GET /webview-hashes`).
const ENTRIES = [
  { directory: 'settings', entry: 'settings' },
  { directory: 'widgets/ata-group-setting/public', entry: 'ata-group-setting' },
  { directory: 'widgets/charts/public', entry: 'charts' },
]

const hashOf = (content: string | Buffer): string =>
  createHash('sha256').update(content).digest('hex').slice(0, HASH_LENGTH)

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
      ENTRIES.map(async ({ directory, entry }): Promise<[string, string]> => [
        entry,
        hashOf(await packagedFile(path.join(directory, 'index.js'))),
      ]),
    )
    const manifest: unknown = JSON.parse(
      await packagedFile('webview-hashes.json'),
    )

    expect(manifest).toStrictEqual(Object.fromEntries(identities))
  })

  it('should stamp nothing in a standalone suite run', async () => {
    await runBundler()

    await expect(packagedFile('webview-hashes.json')).rejects.toThrow('ENOENT')
  })
})
