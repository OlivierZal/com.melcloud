import { createRequire } from 'module'

import type { ManifestDriverCapabilitiesOptions } from '../types/common.mjs'

const LOCAL_CAPABILITIES_PATH = '../.homeycompose/capabilities'
const MODULE_CAPABILITIES_PATH = 'homey-lib/assets/capability/capabilities'

const load = (path: string): object =>
  createRequire(import.meta.url)(path) as object
const loadCapability = (path: string): ManifestDriverCapabilitiesOptions =>
  load(path) as ManifestDriverCapabilitiesOptions

export const changelog = load('../.homeychangelog.json')
export const horizontal = loadCapability(
  `${LOCAL_CAPABILITIES_PATH}/horizontal.json`,
)
export const vertical = loadCapability(
  `${LOCAL_CAPABILITIES_PATH}/vertical.json`,
)
export const fanSpeed = loadCapability(
  `${MODULE_CAPABILITIES_PATH}/fan_speed.json`,
)
export const power = loadCapability(`${MODULE_CAPABILITIES_PATH}/onoff.json`)
export const setTemperature = loadCapability(
  `${MODULE_CAPABILITIES_PATH}/target_temperature.json`,
)
export const thermostatMode = loadCapability(
  `${MODULE_CAPABILITIES_PATH}/thermostat_mode.json`,
)
