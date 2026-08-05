import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

// The two widgets ship separately, so shared snippets are duplicated on
// purpose; these pins keep the copies byte-identical so they cannot drift
// apart silently.
const readWidgetPair = async (
  relativePath: string,
): Promise<(string | undefined)[]> =>
  Promise.all(
    ['ata-group-setting', 'charts'].map(async (widget) =>
      readFile(`widgets/${widget}/public/${relativePath}`, 'utf8'),
    ),
  )

const getBootScript = (page: string | undefined): string =>
  /<script>(?<script>[\s\S]*?)<\/script>/v.exec(page ?? '')?.groups?.script ??
  ''

const getInitErrorRules = (sheet: string | undefined): string[] =>
  (sheet ?? '').match(/#init_error[^\{]*\{[^\}]*\}/gv) ?? []

describe('widget styles', () => {
  it('should keep the zone-select stylesheets byte-identical', async () => {
    const [ataGroupSetting, charts] = await readWidgetPair(
      'styles/zone-select.css',
    )

    expect(ataGroupSetting).toBe(charts)
  })

  it('should keep the inline boot scripts byte-identical', async () => {
    const [ataGroupSetting, charts] = await readWidgetPair('index.html')

    expect(getBootScript(ataGroupSetting)).not.toBe('')
    expect(getBootScript(ataGroupSetting)).toBe(getBootScript(charts))
  })

  it('should keep the init-error styling byte-identical', async () => {
    const [ataGroupSetting, charts] = await readWidgetPair('styles/layout.css')

    expect(getInitErrorRules(ataGroupSetting)).not.toStrictEqual([])
    expect(getInitErrorRules(ataGroupSetting)).toStrictEqual(
      getInitErrorRules(charts),
    )
  })
})
