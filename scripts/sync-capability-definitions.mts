// Refreshes the vendored node-homey-lib capability definitions consumed by
// files.mts — homey-lib is a devDependency and must not ship to the device.
// Keys are re-sorted to the repo's json/sort-keys convention; the values stay
// exactly homey-lib's, pinned by tests/unit/capability-definitions.test.ts.
import { readFile, writeFile } from 'node:fs/promises'

import { sortKeysDeep } from './sort-keys-deep.mts'

const CAPABILITIES = [
  'fan_speed',
  'onoff',
  'target_temperature',
  'thermostat_mode',
]

const JSON_INDENT = 2

await Promise.all(
  CAPABILITIES.map(async (capability) => {
    const definition: unknown = JSON.parse(
      await readFile(
        `node_modules/homey-lib/assets/capability/capabilities/${capability}.json`,
        'utf8',
      ),
    )
    await writeFile(
      `vendor/capabilities/${capability}.json`,
      `${JSON.stringify(sortKeysDeep(definition), undefined, JSON_INDENT)}\n`,
    )
  }),
)
