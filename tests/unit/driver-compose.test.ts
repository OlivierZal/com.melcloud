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
const readThermostatModeOptions = async (driver: string): Promise<unknown> => {
  const compose = JSON.parse(
    await readFile(`drivers/${driver}/driver.compose.json`, 'utf8'),
  ) as { capabilitiesOptions: Record<string, unknown> }
  return compose.capabilitiesOptions.thermostat_mode
}

describe('ata driver compose twins', () => {
  it('should keep the thermostat_mode options byte-identical', async () => {
    const [classic, home] = await Promise.all(
      ['melcloud', 'home-melcloud'].map(async (driver) =>
        readThermostatModeOptions(driver),
      ),
    )

    expect(classic).toBeDefined()
    expect(classic).toStrictEqual(home)
  })
})
