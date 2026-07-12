import type * as Classic from '@olivierzal/melcloud-api/classic'
import type * as Home from '@olivierzal/melcloud-api/home'

import type {
  HomeConvertFromDevice,
  HomeConvertToDevice,
} from '../../types/home.mts'
import {
  type HomeCapabilitiesAtw,
  type HomeSetCapabilitiesAtw,
  operationModeZoneToHome,
  toThermostatModeAtw,
} from '../../types/home-atw.mts'
import { HomeMELCloudDevice } from '../home-device.mts'

type AtwType = typeof Home.DeviceType.Atw

export default class HomeMELCloudDeviceAtw extends HomeMELCloudDevice<AtwType> {
  protected readonly capabilityToDevice: Partial<
    Record<keyof HomeSetCapabilitiesAtw, HomeConvertToDevice<AtwType>>
  > = {
    thermostat_mode: (value: keyof typeof Classic.OperationModeZone) =>
      operationModeZoneToHome[value],
    'thermostat_mode.zone2': (value: keyof typeof Classic.OperationModeZone) =>
      operationModeZoneToHome[value],
  }

  protected readonly deviceToCapability: Record<
    keyof HomeCapabilitiesAtw,
    HomeConvertFromDevice<AtwType>
  > = {
    measure_signal_strength: ({ rssi }) => rssi,
    measure_temperature: ({ roomTemperatureZone1 }) => roomTemperatureZone1,
    'measure_temperature.tank_water': ({ tankWaterTemperature }) =>
      tankWaterTemperature,
    'measure_temperature.zone2': ({ roomTemperatureZone2 }) =>
      roomTemperatureZone2,
    onoff: ({ power: isOn }) => isOn,
    target_temperature: ({ setTemperatureZone1 }) => setTemperatureZone1,
    'target_temperature.tank_water': ({ setTankWaterTemperature }) =>
      setTankWaterTemperature,
    'target_temperature.zone2': ({ setTemperatureZone2 }) =>
      setTemperatureZone2,
    thermostat_mode: ({ operationModeZone1 }) =>
      toThermostatModeAtw(operationModeZone1),
    'thermostat_mode.zone2': ({ operationModeZone2 }) =>
      toThermostatModeAtw(operationModeZone2),
  }

  protected readonly thermostatMode = null
}
