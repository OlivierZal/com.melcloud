// Refreshes the vendored node-homey-lib capability definitions consumed by
// files.mts — homey-lib is a devDependency and must not ship to the device.
// Keys are re-sorted to the repo's json/sort-keys convention; the values stay
// exactly homey-lib's, pinned by tests/unit/capability-definitions.test.ts.
import { readFile, writeFile } from 'node:fs/promises'

const CAPABILITIES = [
  'fan_speed',
  'onoff',
  'target_temperature',
  'thermostat_mode',
]

const sortKeysDeep = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep)
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([key, entry]) => [key, sortKeysDeep(entry)]),
    )
  }
  return value
}

await Promise.all(
  CAPABILITIES.map(async (capability) => {
    const definition = JSON.parse(
      await readFile(
        `node_modules/homey-lib/assets/capability/capabilities/${capability}.json`,
        'utf8',
      ),
    )
    await writeFile(
      `assets/capabilities/${capability}.json`,
      `${JSON.stringify(sortKeysDeep(definition), null, 2)}\n`,
    )
  }),
)
