import type { ManifestDriverCapabilitiesOptions } from './types/common.mts'

export const {
  changelog,
  fanSpeed,
  horizontal,
  power,
  setTemperature,
  thermostatMode,
  vertical,
} = await (async (): Promise<{
  changelog: Record<string, object>
  fanSpeed: ManifestDriverCapabilitiesOptions
  horizontal: ManifestDriverCapabilitiesOptions
  power: ManifestDriverCapabilitiesOptions
  setTemperature: ManifestDriverCapabilitiesOptions
  thermostatMode: ManifestDriverCapabilitiesOptions
  vertical: ManifestDriverCapabilitiesOptions
}> => {
  try {
    return await import('./lib/json-files-with-import.mjs')
  } catch {
    return import('./lib/json-files-with-require.mjs')
  }
})()
