import { type ListDeviceData, DeviceType } from '@olivierzal/melcloud-api'

import type { Capabilities } from '../../types/common.mts'

import {
  energyCapabilityTagMappingAtw,
  getCapabilitiesOptionsAtw,
  getCapabilityTagMappingAtw,
  listCapabilityTagMappingAtw,
  setCapabilityTagMappingAtw,
} from '../../types/atw.mts'
import { BaseMELCloudDriver } from '../base-driver.mts'

export default class MELCloudDriverAtw extends BaseMELCloudDriver<DeviceType.Atw> {
  public readonly energyCapabilityTagMapping = energyCapabilityTagMappingAtw

  public readonly getCapabilitiesOptions = getCapabilitiesOptionsAtw

  public readonly getCapabilityTagMapping = getCapabilityTagMappingAtw

  public readonly listCapabilityTagMapping = listCapabilityTagMappingAtw

  public readonly setCapabilityTagMapping = setCapabilityTagMappingAtw

  public readonly type = DeviceType.Atw

  readonly #zone1Capabilities: (keyof Capabilities<DeviceType.Atw>)[] = [
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
  ]

  readonly #zone1CoolCapabilities: (keyof Capabilities<DeviceType.Atw>)[] = [
    'target_temperature.flow_cool',
  ]

  readonly #zone2Capabilities: (keyof Capabilities<DeviceType.Atw>)[] = [
    'measure_temperature.zone2',
    'target_temperature.zone2',
    'target_temperature.flow_heat_zone2',
    'thermostat_mode.zone2',
    'operational_state.zone2',
  ]

  readonly #zone2CoolCapabilities: (keyof Capabilities<DeviceType.Atw>)[] = [
    'target_temperature.flow_cool_zone2',
  ]

  public getRequiredCapabilities({
    CanCool: canCool,
    HasZone2: hasZone2,
  }: ListDeviceData<DeviceType.Atw>): string[] {
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
