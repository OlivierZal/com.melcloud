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
import type { EnergyReportConfig } from '../base-report.mts'
import {
  horizontalFromDevice,
  operationModeFromDevice,
  ThermostatModeAta,
  verticalFromDevice,
} from '../../types/ata.mts'
import { HomeMELCloudDevice } from '../home-device.mts'
import { HomeEnergyReportAta } from '../home-report-ata.mts'

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

  protected override readonly energyReportRegular: EnergyReportConfig = {
    duration: { hours: 1 },
    mode: 'regular',
    values: { millisecond: 0, minute: 5, second: 0 },
  }

  protected override readonly energyReportTotal: EnergyReportConfig = {
    duration: { hours: 1 },
    mode: 'total',
    values: { millisecond: 0, minute: 5, second: 0 },
  }

  protected override readonly thermostatMode: typeof ThermostatModeAta =
    ThermostatModeAta

  protected override readonly createEnergyReport = (
    config: EnergyReportConfig,
  ): HomeEnergyReportAta => new HomeEnergyReportAta(this, config)

  // The energy capabilities are only served when the unit reports a
  // consumption meter.
  protected override isCapabilitySupported(capability: string): boolean {
    return (
      super.isCapabilitySupported(capability) &&
      (!this.isEnergyCapability(capability) ||
        this.cachedFacade?.capabilities.hasEnergyConsumedMeter === true)
    )
  }
}
