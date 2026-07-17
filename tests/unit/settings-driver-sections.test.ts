import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import manifest from '../../app.json' with { type: 'json' }

// Driver-scoped settings only render inside a hardcoded
// `#settings_<driverId>` container of the settings page: the webview's
// section builder bails out silently when the container is missing, so a
// driver gaining checkbox settings without its HTML section ships toggles
// that never appear (how the Home energy settings first shipped broken).
const SECTION_ID_PREFIXES = [
  'apply_settings_',
  'has_devices_',
  'refresh_settings_',
  'settings_',
]

const hasCheckboxChild = (group: object): boolean =>
  'children' in group &&
  Array.isArray(group.children) &&
  group.children.some(
    (child: unknown) =>
      typeof child === 'object' &&
      child !== null &&
      'type' in child &&
      child.type === 'checkbox',
  )

// The settings page groups entries by `groupId ?? driverId`: only groups
// WITHOUT an id (e.g. not the shared `options` template) land in the
// driver's own section.
const isDriverScopedCheckboxGroup = (group: unknown): boolean =>
  typeof group === 'object' &&
  group !== null &&
  !('id' in group) &&
  hasCheckboxChild(group)

const html = readFileSync(
  new URL('../../settings/index.html', import.meta.url),
  'utf8',
)

describe('settings page driver sections', () => {
  const driverIds = manifest.drivers
    .filter(({ settings }) =>
      (settings as readonly unknown[]).some((group) =>
        isDriverScopedCheckboxGroup(group),
      ),
    )
    .map(({ id }) => id)

  it('should find at least one driver exposing its own checkbox settings', () => {
    expect.assertions(1)
    expect(driverIds.length).toBeGreaterThan(0)
  })

  it.each(driverIds)('should ship the HTML section of %s', (driverId) => {
    expect.assertions(4)

    for (const prefix of SECTION_ID_PREFIXES) {
      expect(html).toContain(`id="${prefix}${driverId.replaceAll('-', '_')}"`)
    }
  })
})
