import {
  type FanSpeed,
  fanSpeedFromClassic,
  fanSpeedToClassic,
  Horizontal,
  horizontalFromClassic,
  horizontalToClassic,
  OperationMode,
  operationModeFromClassic,
  operationModeToClassic,
  Vertical,
  verticalFromClassic,
  verticalToClassic,
} from '@olivierzal/melcloud-api'

import {
  type HomeCapabilitiesAta,
  type HomeConvertFromDevice,
  type HomeConvertToDevice,
  type HomeSetCapabilitiesAta,
  horizontalReverse,
  operationModeReverse,
  ThermostatModeAta,
  verticalReverse,
} from '../../types/index.mts'
import { HomeBaseMELCloudDevice } from '../home-base-device.mts'

export default class HomeMELCloudDeviceAta extends HomeBaseMELCloudDevice {
  protected readonly capabilityToDevice: Partial<
    Record<keyof HomeSetCapabilitiesAta, HomeConvertToDevice>
  > = {
    fan_speed: (value: FanSpeed) => fanSpeedFromClassic[value],
    horizontal: (value: keyof typeof Horizontal) =>
      horizontalFromClassic[Horizontal[value]],
    thermostat_mode: (value: keyof typeof OperationMode) =>
      operationModeFromClassic[OperationMode[value]],
    vertical: (value: keyof typeof Vertical) =>
      verticalFromClassic[Vertical[value]],
  }

  protected readonly deviceToCapability: Record<
    keyof HomeCapabilitiesAta,
    HomeConvertFromDevice
  > = {
    fan_speed: ({ setFanSpeed }) => fanSpeedToClassic[setFanSpeed],
    horizontal: ({ vaneHorizontalDirection }) =>
      horizontalReverse[horizontalToClassic[vaneHorizontalDirection]],
    measure_temperature: ({ roomTemperature }) => roomTemperature,
    onoff: ({ power }) => power,
    target_temperature: ({ setTemperature }) => setTemperature,
    thermostat_mode: ({ operationMode, power }) =>
      power ?
        operationModeReverse[operationModeToClassic[operationMode]]
      : ThermostatModeAta.off,
    vertical: ({ vaneVerticalDirection }) =>
      verticalReverse[verticalToClassic[vaneVerticalDirection]],
  }

  protected readonly thermostatMode = ThermostatModeAta
}
