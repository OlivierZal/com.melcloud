import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

// The two widgets ship separately, so the zone selector's ghost styling is
// duplicated on purpose; this pins the copies byte-identical so they cannot
// drift apart silently.
describe('widget styles', () => {
  it('should keep the zone-select stylesheets byte-identical', async () => {
    const [ataGroupSetting, charts] = await Promise.all(
      [
        'widgets/ata-group-setting/public/styles/zone-select.css',
        'widgets/charts/public/styles/zone-select.css',
      ].map(async (path) => readFile(path, 'utf8')),
    )

    expect(ataGroupSetting).toBe(charts)
  })
})
