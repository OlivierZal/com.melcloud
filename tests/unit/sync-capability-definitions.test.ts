import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The sync script is a top-level-await script reading and writing
// through the current directory, so each test materializes a miniature
// app — a stand-in homey-lib plus an empty vendor directory — moves
// there, and imports the script afresh. The key ordering it applies is
// pinned separately, in tests/unit/sort-keys-deep.test.ts: what belongs
// here is the script's own wiring — which capabilities it vendors, from
// where, and in what on-disk form.
const initialDirectory = process.cwd()

const LIB_ROOT = 'node_modules/homey-lib/assets/capability/capabilities'

const VENDOR_ROOT = 'vendor/capabilities'

const VENDORED = ['fan_speed', 'onoff', 'target_temperature', 'thermostat_mode']

// Raw JSON bytes rather than an object literal, and deliberately
// unsorted: what the script contracts on is the LAYOUT of the file it
// writes, so the fixture has to be an on-disk order — one an object
// literal could not hold, since the repo's own key sorting applies to
// source too.
const definitionOf = (capability: string): string =>
  `{"type":"number","getable":true,"id":"${capability}","$flow":{"actions":[{"args":[{"step":0.5}]}]}}`

const seedApp = async (capabilities: readonly string[]): Promise<void> => {
  await mkdir(LIB_ROOT, { recursive: true })
  await mkdir(VENDOR_ROOT, { recursive: true })
  await Promise.all(
    capabilities.map(async (capability) =>
      writeFile(
        path.join(LIB_ROOT, `${capability}.json`),
        definitionOf(capability),
      ),
    ),
  )
}

const runSync = async (): Promise<void> => {
  vi.resetModules()
  await import('../../scripts/sync-capability-definitions.mts')
}

describe('capability definition sync', () => {
  let workDirectory = ''

  beforeEach(async () => {
    workDirectory = await mkdtemp(path.join(tmpdir(), 'sync-'))
    process.chdir(workDirectory)
  })

  afterEach(async () => {
    process.chdir(initialDirectory)
    await rm(workDirectory, { force: true, recursive: true })
  })

  it('should vendor exactly the capabilities the drivers consume', async () => {
    // A capability homey-lib ships but no driver consumes must not be
    // vendored: the copies are what reaches the device.
    await seedApp([...VENDORED, 'dim'])

    await runSync()

    const vendored = await readdir(VENDOR_ROOT)

    expect(
      vendored.toSorted((left, right) => left.localeCompare(right, 'en')),
    ).toStrictEqual(VENDORED.map((capability) => `${capability}.json`))
  })

  it('should write homey-lib values, sorted and newline-terminated', async () => {
    await seedApp(VENDORED)

    await runSync()

    const written = await readFile(path.join(VENDOR_ROOT, 'onoff.json'), 'utf8')

    expect(written).toBe(
      `${JSON.stringify(
        {
          $flow: { actions: [{ args: [{ step: 0.5 }] }] },
          getable: true,
          id: 'onoff',
          type: 'number',
        },
        undefined,
        2,
      )}\n`,
    )
  })
})
