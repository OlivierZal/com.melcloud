// Refreshes the vendored node-homey-lib capability definitions consumed by
// files.mts — homey-lib is a devDependency and must not ship to the device.
// The copies are laid out the way the JSON lint expects — keys re-sorted to
// the repo's json/sort-keys convention, irregular whitespace escaped — and
// the values stay exactly homey-lib's, pinned by
// tests/unit/capability-definitions.test.ts.
import { readFile, writeFile } from 'node:fs/promises'

import { sortKeysDeep } from './sort-keys-deep.mts'

const CAPABILITIES = [
  'fan_speed',
  'onoff',
  'target_temperature',
  'thermostat_mode',
]

const JSON_INDENT = 2

const HEX_RADIX = 16

// What unicorn/prefer-escaped-irregular-whitespace escapes in JSON, as the
// four hex digits of its fixer's `\uXXXX` form (JSON.stringify already
// escapes the two control characters of the set): homey-lib's French `%`
// unit carries a no-break space, which a raw copy would fail the lint on.
const IRREGULAR_WHITESPACE = [
  '0085',
  '00A0',
  '1680',
  '180E',
  '2000',
  '2001',
  '2002',
  '2003',
  '2004',
  '2005',
  '2006',
  '2007',
  '2008',
  '2009',
  '200A',
  '200B',
  '2028',
  '2029',
  '202F',
  '205F',
  '3000',
  'FEFF',
]

// What the script writes for one vendored copy: sorted keys, two-space
// indent, the lint's escapes, a trailing newline (Prettier reflows it).
const toVendoredJson = (definition: unknown): string => {
  let json = JSON.stringify(sortKeysDeep(definition), undefined, JSON_INDENT)
  for (const hex of IRREGULAR_WHITESPACE) {
    const character = String.fromCodePoint(Number.parseInt(hex, HEX_RADIX))
    json = json.replaceAll(character, () => String.raw`\u${hex}`)
  }
  return `${json}\n`
}

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
      toVendoredJson(definition),
    )
  }),
)
