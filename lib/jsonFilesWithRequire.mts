import { createRequire } from 'module'

import type { ManifestDriverCapabilitiesOptions } from '../types/common.mjs'

const LOCAL_CAPABILITIES_PATH = './.homeycompose/capabilities'
const MODULE_CAPABILITIES_PATH = 'homey-lib/assets/capability/capabilities'

const createdRequire = createRequire(import.meta.url)

const load = (path: string): object => createdRequire(path) as object
const loadCapability = (path: string): ManifestDriverCapabilitiesOptions =>
  load(path) as ManifestDriverCapabilitiesOptions

const changelog = load('./.homeychangelog.json')

const horizontal = loadCapability(`${LOCAL_CAPABILITIES_PATH}/horizontal.json`)
const vertical = loadCapability(`${LOCAL_CAPABILITIES_PATH}/vertical.json`)

const fanSpeed = loadCapability(`${MODULE_CAPABILITIES_PATH}/fan_speed.json`)
const power = loadCapability(`${MODULE_CAPABILITIES_PATH}/onoff.json`)
const setTemperature = loadCapability(
  `${MODULE_CAPABILITIES_PATH}/target_temperature.json`,
)
const thermostatMode = loadCapability(
  `${MODULE_CAPABILITIES_PATH}/thermostat_mode.json`,
)

export {
  changelog,
  fanSpeed,
  horizontal,
  power,
  setTemperature,
  thermostatMode,
  vertical,
}
