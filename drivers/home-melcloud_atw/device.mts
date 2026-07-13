import type * as Home from '@olivierzal/melcloud-api/home'

import type {
  HomeCapabilitiesAtw,
  HomeSetCapabilitiesAtw,
} from '../../types/home-atw.mts'
import type {
  HomeConvertFromDevice,
  HomeConvertToDevice,
} from '../../types/home.mts'
import { HotWaterMode } from '../../types/atw.mts'
import { HomeMELCloudDevice } from '../home-device.mts'

type AtwType = typeof Home.DeviceType.Atw

export default class HomeMELCloudDeviceAtw extends HomeMELCloudDevice<AtwType> {
  // The zone modes and operational states need no conversion: the facade
  // already exposes the normalized vocabularies the capabilities use.
  protected readonly capabilityToDevice: Partial<
    Record<keyof HomeSetCapabilitiesAtw, HomeConvertToDevice<AtwType>>
  > = {
    hot_water_mode: (value: keyof typeof HotWaterMode) =>
      HotWaterMode[value] === HotWaterMode.forced,
  }

  protected readonly deviceToCapability: Record<
    keyof HomeCapabilitiesAtw,
    HomeConvertFromDevice<AtwType>
  > = {
    hot_water_mode: ({ forcedHotWaterMode: isForced }) =>
      isForced ? HotWaterMode.forced : HotWaterMode.auto,
    measure_signal_strength: ({ rssi }) => rssi,
    measure_temperature: ({ roomTemperatureZone1 }) => roomTemperatureZone1,
    'measure_temperature.tank_water': ({ tankWaterTemperature }) =>
      tankWaterTemperature,
    'measure_temperature.zone2': ({ roomTemperatureZone2 }) =>
      roomTemperatureZone2,
    onoff: ({ power: isOn }) => isOn,
    operational_state: ({ operationalState }) => operationalState,
    'operational_state.hot_water': ({ hotWaterOperationalState }) =>
      hotWaterOperationalState,
    'operational_state.zone1': ({ operationalStateZone1 }) =>
      operationalStateZone1,
    'operational_state.zone2': ({ operationalStateZone2 }) =>
      operationalStateZone2,
    target_temperature: ({ setTemperatureZone1: temperature }) => temperature,
    'target_temperature.tank_water': ({
      setTankWaterTemperature: temperature,
    }) => temperature,
    'target_temperature.zone2': ({ setTemperatureZone2: temperature }) =>
      temperature,
    thermostat_mode: ({ operationModeZone1 }) => operationModeZone1,
    'thermostat_mode.zone2': ({ operationModeZone2 }) => operationModeZone2,
  }
}
