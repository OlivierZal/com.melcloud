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
  changelog: object
  fanSpeed: ManifestDriverCapabilitiesOptions
  horizontal: ManifestDriverCapabilitiesOptions
  power: ManifestDriverCapabilitiesOptions
  setTemperature: ManifestDriverCapabilitiesOptions
  thermostatMode: ManifestDriverCapabilitiesOptions
  vertical: ManifestDriverCapabilitiesOptions
}> => {
  try {
    return await import('./lib/jsonFilesWithImport.mts')
  } catch {
    return import('./lib/jsonFilesWithRequire.mjs')
  }
})()
