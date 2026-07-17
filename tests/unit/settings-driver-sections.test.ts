import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import manifest from '../../app.json' with { type: 'json' }

// The settings page builds one section per driver at runtime inside a single
// container; nothing is hardcoded per driver. These checks pin that contract
// so a future edit cannot silently reintroduce the per-driver duplication
// that once shipped Home toggles with no section (or a snake_case id drift).
const html = readFileSync(
  new URL('../../settings/index.html', import.meta.url),
  'utf8',
)

describe('settings page device sections', () => {
  it('should expose the single generation container', () => {
    expect.assertions(1)
    expect(html).toContain('id="device_settings"')
  })

  it('should keep the Classic air-to-air auto-adjust section', () => {
    expect.assertions(2)
    expect(html).toContain('id="auto_adjust_section"')
    expect(html).toContain('id="auto_adjust"')
  })

  it.each(manifest.drivers.map(({ id }) => id))(
    'should hardcode no per-driver section for %s',
    (driverId) => {
      const sectionId = driverId.replaceAll('-', '_')

      expect.assertions(2)
      expect(html).not.toContain(`id="has_devices_${sectionId}"`)
      expect(html).not.toContain(`id="settings_${sectionId}"`)
    },
  )
})
