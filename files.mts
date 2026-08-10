// `app.mts` loads this module at boot, so the device parses it before
// running anything: import attributes (`with { type: 'json' }`) are a
// parse-time SyntaxError on the pre-Node-20 engine of the oldest
// firmware the manifest supports, and no try/catch can recover a module
// that never parsed. `createRequire` reads the same files with syntax
// every engine accepts, while the type-only imports keep tsc's
// inference and erase at emit. `tests/unit/node-floor.test.ts` holds
// the invariant for every shipped module, not just this one.
import { createRequire } from 'node:module'

import type ChangelogJson from './.homeychangelog.json'
import type HorizontalJson from './.homeycompose/capabilities/horizontal.json'
import type VerticalJson from './.homeycompose/capabilities/vertical.json'
import type FanSpeedJson from './vendor/capabilities/fan_speed.json'
import type PowerJson from './vendor/capabilities/onoff.json'
import type TargetTemperatureJson from './vendor/capabilities/target_temperature.json'
import type ThermostatModeJson from './vendor/capabilities/thermostat_mode.json'

// Binds every readable path to the shape tsc inferred for it, so a
// mistyped path is a compile error rather than a runtime one.
interface JsonFiles {
  './.homeychangelog.json': typeof ChangelogJson
  './.homeycompose/capabilities/horizontal.json': typeof HorizontalJson
  './.homeycompose/capabilities/vertical.json': typeof VerticalJson
  './vendor/capabilities/fan_speed.json': typeof FanSpeedJson
  './vendor/capabilities/onoff.json': typeof PowerJson
  './vendor/capabilities/target_temperature.json': typeof TargetTemperatureJson
  './vendor/capabilities/thermostat_mode.json': typeof ThermostatModeJson
}

const requireJson = createRequire(import.meta.url)

const loadJson = <TPath extends keyof JsonFiles>(
  path: TPath,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the module system types every read as `any`; the mapping above restores the shape tsc inferred
): JsonFiles[TPath] => requireJson(path) as JsonFiles[TPath]

export const changelog: typeof ChangelogJson = loadJson(
  './.homeychangelog.json',
)
export const horizontal: typeof HorizontalJson = loadJson(
  './.homeycompose/capabilities/horizontal.json',
)
export const vertical: typeof VerticalJson = loadJson(
  './.homeycompose/capabilities/vertical.json',
)
export const fanSpeed: typeof FanSpeedJson = loadJson(
  './vendor/capabilities/fan_speed.json',
)
export const power: typeof PowerJson = loadJson(
  './vendor/capabilities/onoff.json',
)
export const targetTemperature: typeof TargetTemperatureJson = loadJson(
  './vendor/capabilities/target_temperature.json',
)
export const thermostatMode: typeof ThermostatModeJson = loadJson(
  './vendor/capabilities/thermostat_mode.json',
)
