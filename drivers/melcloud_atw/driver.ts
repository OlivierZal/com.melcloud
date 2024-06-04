import {
  type Capabilities,
  type Store,
  energyCapabilityTagMappingAtw,
  getCapabilityTagMappingAtw,
  listCapabilityTagMappingAtw,
  setCapabilityTagMappingAtw,
  storeMappingAtw,
} from '../../types'
import { DeviceType, effectiveFlagsAtw } from '@olivierzal/melcloud-api'
import BaseMELCloudDriver from '../../bases/driver'

export = class extends BaseMELCloudDriver<'Atw'> {
  public readonly effectiveFlags = effectiveFlagsAtw

  public readonly energyCapabilityTagMapping = energyCapabilityTagMappingAtw

  public readonly getCapabilityTagMapping = getCapabilityTagMappingAtw

  public readonly listCapabilityTagMapping = listCapabilityTagMappingAtw

  public readonly setCapabilityTagMapping = setCapabilityTagMappingAtw

  protected readonly deviceType = DeviceType.Atw

  protected readonly storeMapping = storeMappingAtw

  readonly #zone1Capabilities: (keyof Capabilities['Atw'])[] = [
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
    'operation_mode_state',
    'operation_mode_state.hot_water',
    'operation_mode_state.zone1',
    'measure_power.heat_pump_frequency',
    'measure_power',
    'measure_power.produced',
    'boolean.idle_zone1',
    'boolean.heating_zone1',
    'boolean.prohibit_heating_zone1',
    'boolean.prohibit_hot_water',
  ]

  readonly #zone1CoolCapabilities: (keyof Capabilities['Atw'])[] = [
    'target_temperature.flow_cool',
    'operation_mode_zone_with_cool',
    'boolean.cooling_zone1',
    'boolean.prohibit_cooling_zone1',
  ]

  readonly #zone2Capabilities: (keyof Capabilities['Atw'])[] = [
    'measure_temperature.zone2',
    'target_temperature.zone2',
    'target_temperature.flow_heat_zone2',
    'operation_mode_state.zone2',
    'boolean.idle_zone2',
    'boolean.heating_zone2',
    'boolean.prohibit_heating_zone2',
  ]

  readonly #zone2CoolCapabilities: (keyof Capabilities['Atw'])[] = [
    'target_temperature.flow_cool_zone2',
    'operation_mode_zone_with_cool.zone2',
    'boolean.cooling_zone2',
    'boolean.prohibit_cooling_zone2',
  ]

  public getRequiredCapabilities({
    canCool,
    hasZone2,
  }: Store['Atw']): string[] {
    return [
      ...this.#zone1Capabilities,
      ...(canCool ? this.#zone1CoolCapabilities : ['operation_mode_zone']),
      ...(hasZone2 ?
        [
          ...this.#zone2Capabilities,
          ...(canCool ?
            this.#zone2CoolCapabilities
          : ['operation_mode_zone.zone2']),
        ]
      : []),
    ]
  }
}
