import type { ManifestDriverCapabilitiesOptions } from './types/common.mjs'

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
}> => import('./lib/jsonFilesWithImport.mjs'))()
