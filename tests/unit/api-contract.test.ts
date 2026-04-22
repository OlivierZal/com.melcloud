import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

// The three `api.mts` modules import from `lib/classic-facade-manager.mts`,
// which has real side effects. Mock it so that importing them is safe.
vi.mock(import('../../lib/classic-facade-manager.mts'), () => ({
  getClassicBuildings: vi.fn<() => never[]>(),
  getClassicZones: vi.fn<() => never[]>(),
}))

const { default: settingsApi } = await import('../../api.mts')
const { default: ataGroupApi } =
  await import('../../widgets/ata-group-setting/api.mts')
const { default: chartsApi } = await import('../../widgets/charts/api.mts')

const readApiKeys = (relativePath: string): string[] => {
  const url = new URL(relativePath, import.meta.url)
  const raw = readFileSync(fileURLToPath(url), 'utf8')
  const parsed = JSON.parse(raw) as { api?: Record<string, unknown> }
  return Object.keys(parsed.api ?? {}).toSorted((left, right) => left.localeCompare(right))
}

// Handler config is authoritative in `.homeycompose/app.json` and each
// `widget.compose.json`; the compiled `app.json` is a build artifact.
describe('api contract', () => {
  it.each<[string, string, Record<string, unknown>]>([
    ['settings', '../../.homeycompose/app.json', settingsApi],
    [
      'ata-group-setting widget',
      '../../widgets/ata-group-setting/widget.compose.json',
      ataGroupApi,
    ],
    ['charts widget', '../../widgets/charts/widget.compose.json', chartsApi],
  ])(
    'every %s endpoint declared in config has a matching handler',
    (_name, configPath, handlers) => {
      expect(
        Object.keys(handlers).toSorted((left, right) => left.localeCompare(right)),
      ).toStrictEqual(readApiKeys(configPath))
    },
  )
})
