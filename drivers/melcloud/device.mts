import * as Classic from '@olivierzal/melcloud-api/classic'

import type {
  ConvertFromDevice,
  ConvertToDevice,
  OperationalCapabilities,
  SetCapabilities,
} from '../../types/capabilities.mts'
import type { EnergyReportConfig } from '../base-report.mts'
import {
  horizontalFromDevice,
  operationModeFromDevice,
  ThermostatModeAta,
  verticalFromDevice,
} from '../../types/ata.mts'
import { ClassicMELCloudDevice } from '../classic-device.mts'

export default class ClassicMELCloudDeviceAta extends ClassicMELCloudDevice<
  typeof Classic.DeviceType.Ata
> {
  protected readonly capabilityToDevice: Partial<
    Record<
      keyof SetCapabilities<typeof Classic.DeviceType.Ata>,
      ConvertToDevice<typeof Classic.DeviceType.Ata>
    >
  > = {
    horizontal: (value: keyof typeof Classic.Horizontal) =>
      Classic.Horizontal[value],
    thermostat_mode: (value: keyof typeof Classic.OperationMode) =>
      Classic.OperationMode[value],
    vertical: (value: keyof typeof Classic.Vertical) => Classic.Vertical[value],
  }

  protected readonly deviceToCapability: Partial<
    Record<
      keyof OperationalCapabilities<typeof Classic.DeviceType.Ata>,
      ConvertFromDevice<typeof Classic.DeviceType.Ata>
    >
  > = {
    'alarm_generic.silent': (value: Classic.FanSpeed) =>
      value === Classic.FanSpeed.silent,
    fan_speed: (value: Classic.FanSpeed) =>
      value === Classic.FanSpeed.silent ? Classic.FanSpeed.auto : value,
    horizontal: (value: Classic.Horizontal) => horizontalFromDevice[value],
    thermostat_mode: (
      value: Classic.OperationMode,
      data: Classic.ListDeviceData<typeof Classic.DeviceType.Ata>,
    ) => (data.Power ? operationModeFromDevice[value] : ThermostatModeAta.off),
    vertical: (value: Classic.Vertical) => verticalFromDevice[value],
  }

  protected readonly energyReportRegular: EnergyReportConfig = {
    duration: { hours: 1 },
    interval: { hours: 1 },
    minus: { hours: 1 },
    mode: 'regular',
    values: { millisecond: 0, minute: 5, second: 0 },
  }

  protected readonly energyReportTotal: EnergyReportConfig = {
    duration: { days: 1 },
    interval: { days: 1 },
    minus: { hours: 1 },
    mode: 'total',
    values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
  }

  protected readonly thermostatMode = ThermostatModeAta
}
