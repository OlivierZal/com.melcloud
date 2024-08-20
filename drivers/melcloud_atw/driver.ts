import type { ListDeviceDataAtw } from '@olivierzal/melcloud-api'

import BaseMELCloudDriver from '../../bases/driver'
import {
  type CapabilitiesAtw,
  ENERGY_CAPABILITY_TAG_MAPPING_ATW,
  GET_CAPABILITY_TAGS_MAPPING_ATW,
  LIST_CAPABILITY_TAGS_MAPPING_ATW,
  SET_CAPABILITY_TAGS_MAPPING_ATW,
} from '../../types'

export = class extends BaseMELCloudDriver<'Atw'> {
  public readonly energyCapabilityTagMapping = ENERGY_CAPABILITY_TAG_MAPPING_ATW

  public readonly getCapabilityTagMapping = GET_CAPABILITY_TAGS_MAPPING_ATW

  public readonly listCapabilityTagMapping = LIST_CAPABILITY_TAGS_MAPPING_ATW

  public readonly setCapabilityTagMapping = SET_CAPABILITY_TAGS_MAPPING_ATW

  public readonly type = 'Atw'

  readonly #zone1Capabilities: (keyof CapabilitiesAtw)[] = [
    'onoff',
    'onoff.forced_hot_water',
    'measure_temperature',
    'measure_temperature.outdoor',
    'measure_temperature.flow',
    'measure_temperature.return',
    'measure_temperature.tank_water',
    'target_temperature',
    'target_temperature.tank_water',
    'target_temperature.flow_heat',
    'thermostat_mode',
    'operation_mode_state',
    'operation_mode_state.hot_water',
    'operation_mode_state.zone1',
    'measure_power.heat_pump_frequency',
    'measure_power',
    'measure_power.produced',
  ]

  readonly #zone1CoolCapabilities: (keyof CapabilitiesAtw)[] = [
    'target_temperature.flow_cool',
  ]

  readonly #zone2Capabilities: (keyof CapabilitiesAtw)[] = [
    'measure_temperature.zone2',
    'target_temperature.zone2',
    'target_temperature.flow_heat_zone2',
    'thermostat_mode.zone2',
    'operation_mode_state.zone2',
  ]

  readonly #zone2CoolCapabilities: (keyof CapabilitiesAtw)[] = [
    'target_temperature.flow_cool_zone2',
  ]

  public getRequiredCapabilities({
    CanCool: canCool,
    HasZone2: hasZone2,
  }: ListDeviceDataAtw): string[] {
    return [
      ...this.#zone1Capabilities,
      ...(canCool ? this.#zone1CoolCapabilities : []),
      ...(hasZone2 ?
        [
          ...this.#zone2Capabilities,
          ...(canCool ? this.#zone2CoolCapabilities : []),
        ]
      : []),
    ]
  }
}
