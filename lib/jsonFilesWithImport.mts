import fanSpeed from 'homey-lib/assets/capability/capabilities/fan_speed.json' with { type: 'json' }
import power from 'homey-lib/assets/capability/capabilities/onoff.json' with { type: 'json' }
import setTemperature from 'homey-lib/assets/capability/capabilities/target_temperature.json' with { type: 'json' }
import thermostatMode from 'homey-lib/assets/capability/capabilities/thermostat_mode.json' with { type: 'json' }

import changelog from '../.homeychangelog.json' with { type: 'json' }
import horizontal from '../.homeycompose/capabilities/horizontal.json' with { type: 'json' }
import vertical from '../.homeycompose/capabilities/vertical.json' with { type: 'json' }

export {
  changelog,
  fanSpeed,
  horizontal,
  power,
  setTemperature,
  thermostatMode,
  vertical,
}
