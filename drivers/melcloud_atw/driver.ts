import type { ListDeviceDataAtw } from '@olivierzal/melcloud-api'

import BaseMELCloudDriver from '../../bases/driver'
import {
  type CapabilitiesAtw,
  energyCapabilityTagMappingAtw,
  getCapabilitiesOptionsAtw,
  getCapabilityTagMappingAtw,
  listCapabilityTagMappingAtw,
  setCapabilityTagMappingAtw,
} from '../../types'

export = class extends BaseMELCloudDriver<'Atw'> {
  public readonly energyCapabilityTagMapping = energyCapabilityTagMappingAtw

  public readonly getCapabilitiesOptions = getCapabilitiesOptionsAtw

  public readonly getCapabilityTagMapping = getCapabilityTagMappingAtw

  public readonly listCapabilityTagMapping = listCapabilityTagMappingAtw

  public readonly setCapabilityTagMapping = setCapabilityTagMappingAtw

  public readonly type = 'Atw'

  readonly #zone1Capabilities: (keyof CapabilitiesAtw)[] = [
    'onoff',
    'hot_water_mode',
    'measure_temperature',
    'measure_temperature.outdoor',
    'measure_temperature.flow',
    'measure_temperature.return',
    'measure_temperature.tank_water',
    'target_temperature',
    'target_temperature.tank_water',
    'target_temperature.flow_heat',
    'thermostat_mode',
    'operational_state',
    'operational_state.hot_water',
    'operational_state.zone1',
    'measure_frequency',
    'measure_power',
    'measure_power.produced',
  ] as const

  readonly #zone1CoolCapabilities: (keyof CapabilitiesAtw)[] = [
    'target_temperature.flow_cool',
  ] as const

  readonly #zone2Capabilities: (keyof CapabilitiesAtw)[] = [
    'measure_temperature.zone2',
    'target_temperature.zone2',
    'target_temperature.flow_heat_zone2',
    'thermostat_mode.zone2',
    'operational_state.zone2',
  ] as const

  readonly #zone2CoolCapabilities: (keyof CapabilitiesAtw)[] = [
    'target_temperature.flow_cool_zone2',
  ] as const

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
