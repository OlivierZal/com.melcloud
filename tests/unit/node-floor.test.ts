import { execFileSync } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { getErrorMessage } from '@olivierzal/homey-kit'
import { parse } from 'acorn'
import { describe, expect, it } from 'vitest'

// The device parses every shipped module before running a line of it, so
// syntax the firmware's engine does not know is a boot-time
// `SyntaxError`, not a degraded feature. Two such crashes reached users:
// the es2024 regex `v` flag, then import attributes
// (`with { type: 'json' }`) — the second a regression of an explicit
// 2024 fix that a refactor had quietly undone.
//
// The floor follows the firmware the manifest claims to support. Homey
// Pro (2016-2019) firmwares before 13.4 run a pre-Node-20 engine —
// established from a crash report's own stack, which names `ESMLoader`,
// a class Node renamed in 18.19.0. es2022 is the last language level
// that engine parses whole: es2023 added no syntax, es2024 added the `v`
// flag, es2025 added import attributes.
//
// This guard is exhaustive BY CONSTRUCTION rather than by a list: it
// parses the real emitted output at the floor, so any future syntax the
// engine cannot read fails here, including forms nobody has thought to
// look for. Runtime APIs are a different family — they parse fine and
// throw on use — and no parser can see them.
const LANGUAGE_FLOOR = 2022

const TIMEOUT_MS = 120_000

const emitShippedCode = (outDirectory: string): void => {
  execFileSync(process.execPath, [
    path.join('node_modules', '@typescript', 'native', 'bin', 'tsc'),
    '--project',
    'tsconfig.build.json',
    '--outDir',
    outDirectory,
  ])
}

const collectModules = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(directory, entry.name)

      if (entry.isDirectory()) {
        return collectModules(full)
      }
      return entry.name.endsWith('.mjs') ? [full] : []
    }),
  )

  return nested.flat()
}

const parseFailure = (source: string): string | null => {
  try {
    parse(source, { ecmaVersion: LANGUAGE_FLOOR, sourceType: 'module' })

    return null
  } catch (error) {
    return getErrorMessage(error)
  }
}

describe('shipped syntax stays within the oldest supported engine', () => {
  it(
    `parses every emitted module at es${String(LANGUAGE_FLOOR)}`,
    { timeout: TIMEOUT_MS },
    async () => {
      const outDirectory = await mkdtemp(path.join(tmpdir(), 'node-floor-'))

      try {
        emitShippedCode(outDirectory)

        const modules = await collectModules(outDirectory)

        // A guard that silently measures nothing is worse than none.
        expect(modules.length).toBeGreaterThan(0)

        const results = await Promise.all(
          modules.map(async (file) => {
            const message = parseFailure(await readFile(file, 'utf8'))

            return message === null
              ? null
              : `${path.relative(outDirectory, file)}: ${message}`
          }),
        )

        expect(results.filter((result) => result !== null)).toStrictEqual([])
      } finally {
        await rm(outDirectory, { force: true, recursive: true })
      }
    },
  )

  it('rejects the two syntaxes that took the app down on device', () => {
    expect(
      parseFailure("import x from './a.json' with { type: 'json' }"),
    ).toMatch(/Unexpected token/v)
    expect(parseFailure('const pattern = /a/v')).toMatch(
      /Invalid regular expression flag/v,
    )
    expect(parseFailure('const pattern = /a/u')).toBeNull()
  })
})
