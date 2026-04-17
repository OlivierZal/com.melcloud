import * as Classic from '@olivierzal/melcloud-api/classic'

import type { Capabilities } from '../../types/capabilities.mts'
import {
  energyCapabilityTagMapping,
  getCapabilitiesOptions,
  getCapabilityTagMapping,
  listCapabilityTagMapping,
  setCapabilityTagMapping,
} from '../../types/classic-atw.mts'
import { ClassicMELCloudDriver } from '../classic-driver.mts'

export default class ClassicMELCloudDriverAtw extends ClassicMELCloudDriver<
  typeof Classic.DeviceType.Atw
> {
  public readonly energyCapabilityTagMapping = energyCapabilityTagMapping

  public readonly getCapabilitiesOptions = getCapabilitiesOptions

  public readonly getCapabilityTagMapping = getCapabilityTagMapping

  public readonly listCapabilityTagMapping = listCapabilityTagMapping

  public readonly setCapabilityTagMapping = setCapabilityTagMapping

  public readonly type = Classic.DeviceType.Atw

  readonly #zone1Capabilities: (keyof Capabilities<
    typeof Classic.DeviceType.Atw
  >)[] = [
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
    typeof Classic.DeviceType.Atw
  >)[] = ['target_temperature.flow_cool']

  readonly #zone2Capabilities: (keyof Capabilities<
    typeof Classic.DeviceType.Atw
  >)[] = [
    'measure_temperature.zone2',
    'target_temperature.zone2',
    'target_temperature.flow_heat_zone2',
    'thermostat_mode.zone2',
    'operational_state.zone2',
  ]

  readonly #zone2CoolCapabilities: (keyof Capabilities<
    typeof Classic.DeviceType.Atw
  >)[] = ['target_temperature.flow_cool_zone2']

  public override getRequiredCapabilities(
    data?: Readonly<Classic.ListDeviceData<typeof Classic.DeviceType.Atw>>,
  ): string[] {
    /* v8 ignore next -- data is always provided by callers */
    const { CanCool: canCool, HasZone2: hasClassicZone2 } = data ?? {}
    return [
      ...this.#zone1Capabilities,
      ...(canCool === true ? this.#zone1CoolCapabilities : []),
      ...(hasClassicZone2 === true ?
        [
          ...this.#zone2Capabilities,
          ...(canCool === true ? this.#zone2CoolCapabilities : []),
        ]
      : []),
    ]
  }
}
