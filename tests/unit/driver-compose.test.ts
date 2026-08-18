import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

// The two ATA drivers configure `thermostat_mode` identically, and the
// compose template mechanism cannot carry the sharing: template-over-
// template merging is shallow per top-level property (measured
// 2026-08-18 — an `ata` template's `capabilitiesOptions` erased every
// `defaults`-inherited entry), so hoisting the block would either lose
// the defaults or lean on the template precedence CLAUDE.md forbids.
// The twins stay; this pin is what turns an edit to one without the
// other into a failure instead of a silent drift.
//
// Raw text, not parsed JSON: byte identity is the pin (the widget-styles
// twin pattern), so formatting or key-order drift fails too. The slice
// is stable because `thermostat_mode` closes at the only 4-space `}` of
// the block in these prettier-formatted files.
const readThermostatModeBlock = async (driver: string): Promise<string> => {
  const compose = await readFile(
    `drivers/${driver}/driver.compose.json`,
    'utf8',
  )
  const lines = compose.split('\n')
  const start = lines.indexOf('    "thermostat_mode": {')
  const end = lines.indexOf('    }', start)
  return start === -1 || end === -1
    ? ''
    : lines.slice(start, end + 1).join('\n')
}

describe('ata driver compose twins', () => {
  it('should keep the thermostat_mode options byte-identical', async () => {
    const [classic, home] = await Promise.all(
      ['melcloud', 'home-melcloud'].map(async (driver) =>
        readThermostatModeBlock(driver),
      ),
    )

    expect(classic).not.toBe('')
    expect(classic).toBe(home)
  })
})
