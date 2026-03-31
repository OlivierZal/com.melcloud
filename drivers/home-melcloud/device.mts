import {
  type FanSpeed,
  type HomeAtaValues,
  fanSpeedFromClassic,
  Horizontal,
  horizontalFromClassic,
  Vertical,
  verticalFromClassic,
} from '@olivierzal/melcloud-api'

import { ThermostatModeAta } from '../../types/index.mts'
import { HomeBaseMELCloudDevice } from '../home-base-device.mts'

const thermostatModeToHomeApi: Record<string, string> = {
  auto: 'Automatic',
  cool: 'Cool',
  dry: 'Dry',
  fan: 'Fan',
  heat: 'Heat',
}

export default class HomeMELCloudDeviceAta extends HomeBaseMELCloudDevice {
  protected readonly capabilityToDevice = {
    fan_speed: (value: FanSpeed): HomeAtaValues[keyof HomeAtaValues] =>
      fanSpeedFromClassic[value],
    horizontal: (
      value: keyof typeof Horizontal,
    ): HomeAtaValues[keyof HomeAtaValues] =>
      horizontalFromClassic[Horizontal[value]],
    thermostat_mode: (value: string): HomeAtaValues[keyof HomeAtaValues] =>
      thermostatModeToHomeApi[value] ?? value,
    vertical: (
      value: keyof typeof Vertical,
    ): HomeAtaValues[keyof HomeAtaValues] =>
      verticalFromClassic[Vertical[value]],
  }

  protected readonly deviceToCapability = {}

  protected readonly thermostatMode = ThermostatModeAta
}
