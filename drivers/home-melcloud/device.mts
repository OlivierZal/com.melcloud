import type * as Home from '@olivierzal/melcloud-api/home'
import {
  fanSpeedFromClassic,
  fanSpeedToClassic,
  horizontalFromClassic,
  horizontalToClassic,
  operationModeFromClassic,
  operationModeToClassic,
  verticalFromClassic,
  verticalToClassic,
} from '@olivierzal/melcloud-api'
import * as Classic from '@olivierzal/melcloud-api/classic'

import type {
  HomeCapabilitiesAta,
  HomeSetCapabilitiesAta,
} from '../../types/home-ata.mts'
import type {
  HomeConvertFromDevice,
  HomeConvertToDevice,
} from '../../types/home.mts'
import {
  horizontalFromDevice,
  operationModeFromDevice,
  ThermostatModeAta,
  verticalFromDevice,
} from '../../types/ata.mts'
import { HomeMELCloudDevice } from '../home-device.mts'

type AtaType = typeof Home.DeviceType.Ata

export default class HomeMELCloudDeviceAta extends HomeMELCloudDevice<AtaType> {
  protected readonly capabilityToDevice: Partial<
    Record<keyof HomeSetCapabilitiesAta, HomeConvertToDevice<AtaType>>
  > = {
    fan_speed: (value: Classic.FanSpeed) => fanSpeedFromClassic[value],
    horizontal: (value: keyof typeof Classic.Horizontal) =>
      horizontalFromClassic[Classic.Horizontal[value]],
    thermostat_mode: (value: keyof typeof Classic.OperationMode) =>
      operationModeFromClassic[Classic.OperationMode[value]],
    vertical: (value: keyof typeof Classic.Vertical) =>
      verticalFromClassic[Classic.Vertical[value]],
  }

  protected readonly deviceToCapability: Record<
    keyof HomeCapabilitiesAta,
    HomeConvertFromDevice<AtaType>
  > = {
    fan_speed: ({ setFanSpeed: speed }) => fanSpeedToClassic[speed],
    horizontal: ({ vaneHorizontalDirection }) =>
      horizontalFromDevice[horizontalToClassic[vaneHorizontalDirection]],
    measure_signal_strength: ({ rssi }) => rssi,
    measure_temperature: ({ roomTemperature }) => roomTemperature,
    onoff: ({ power: isOn }) => isOn,
    target_temperature: ({ setTemperature: temperature }) => temperature,
    thermostat_mode: ({ operationMode, power: isOn }) =>
      isOn ?
        operationModeFromDevice[operationModeToClassic[operationMode]]
      : ThermostatModeAta.off,
    vertical: ({ vaneVerticalDirection }) =>
      verticalFromDevice[verticalToClassic[vaneVerticalDirection]],
  }

  protected override readonly thermostatMode: typeof ThermostatModeAta =
    ThermostatModeAta
}
