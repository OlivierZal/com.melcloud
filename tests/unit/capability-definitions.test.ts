import { describe, expect, it } from 'vitest'
import libFanSpeed from 'homey-lib/assets/capability/capabilities/fan_speed.json' with { type: 'json' }
import libPower from 'homey-lib/assets/capability/capabilities/onoff.json' with { type: 'json' }
import libTargetTemperature from 'homey-lib/assets/capability/capabilities/target_temperature.json' with { type: 'json' }
import libThermostatMode from 'homey-lib/assets/capability/capabilities/thermostat_mode.json' with { type: 'json' }

import {
  fanSpeed,
  power,
  targetTemperature,
  thermostatMode,
} from '../../files.mts'

// homey-lib is a devDependency: the runtime consumes the vendored copies
// under vendor/capabilities. Refresh them with
// `node scripts/sync-capability-definitions.mjs` when this fails.
describe('vendored capability definitions', () => {
  it.each([
    ['fan_speed', fanSpeed, libFanSpeed],
    ['onoff', power, libPower],
    ['target_temperature', targetTemperature, libTargetTemperature],
    ['thermostat_mode', thermostatMode, libThermostatMode],
  ])(
    'should match the homey-lib definition of %s',
    (_capability, vendored, lib) => {
      expect(vendored).toStrictEqual(lib)
    },
  )
})
