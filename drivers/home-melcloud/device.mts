import {
  type FanSpeed,
  type HomeDeviceAtaFacade,
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
  homeSetCapabilityTagMappingAta,
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

  /* v8 ignore start -- tested via TestHomeDevice which provides its own implementation */
  protected override getFacade(): HomeDeviceAtaFacade {
    return this.homey.app.getHomeFacade(this.id)
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- returns module-level constant, no instance state needed
  protected override getSetCapabilityTagMapping(): Record<string, string> {
    return homeSetCapabilityTagMappingAta
  }
  /* v8 ignore stop */
}
