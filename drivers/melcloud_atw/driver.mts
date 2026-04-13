import { type ListDeviceData, DeviceType } from '@olivierzal/melcloud-api'

import {
  type Capabilities,
  classicEnergyCapabilityTagMappingAtw,
  classicGetCapabilitiesOptionsAtw,
  classicGetCapabilityTagMappingAtw,
  classicListCapabilityTagMappingAtw,
  classicSetCapabilityTagMappingAtw,
} from '../../types/index.mts'
import { ClassicMELCloudDriver } from '../classic-base-driver.mts'

export default class ClassicMELCloudDriverAtw extends ClassicMELCloudDriver<
  typeof DeviceType.Atw
> {
  public readonly energyCapabilityTagMapping =
    classicEnergyCapabilityTagMappingAtw

  public readonly getCapabilitiesOptions = classicGetCapabilitiesOptionsAtw

  public readonly getCapabilityTagMapping = classicGetCapabilityTagMappingAtw

  public readonly listCapabilityTagMapping = classicListCapabilityTagMappingAtw

  public readonly setCapabilityTagMapping = classicSetCapabilityTagMappingAtw

  public readonly type = DeviceType.Atw

  readonly #zone1Capabilities: (keyof Capabilities<typeof DeviceType.Atw>)[] = [
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

  readonly #zone1CoolCapabilities: (keyof Capabilities<
    typeof DeviceType.Atw
  >)[] = ['target_temperature.flow_cool']

  readonly #zone2Capabilities: (keyof Capabilities<typeof DeviceType.Atw>)[] = [
    'measure_temperature.zone2',
    'target_temperature.zone2',
    'target_temperature.flow_heat_zone2',
    'thermostat_mode.zone2',
    'operational_state.zone2',
  ]

  readonly #zone2CoolCapabilities: (keyof Capabilities<
    typeof DeviceType.Atw
  >)[] = ['target_temperature.flow_cool_zone2']

  public override getRequiredCapabilities(
    data?: ListDeviceData<typeof DeviceType.Atw>,
  ): string[] {
    /* v8 ignore next -- data is always provided by callers */
    const { CanCool: canCool, HasZone2: hasZone2 } = data ?? {}
    return [
      ...this.#zone1Capabilities,
      ...(canCool === true ? this.#zone1CoolCapabilities : []),
      ...(hasZone2 === true ?
        [
          ...this.#zone2Capabilities,
          ...(canCool === true ? this.#zone2CoolCapabilities : []),
        ]
      : []),
    ]
  }
}
