import {
  type DeviceType,
  type ListDeviceData,
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
} from '@olivierzal/melcloud-api'

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
  typeof DeviceType.Ata
> {
  protected readonly capabilityToDevice: Partial<
    Record<
      keyof SetCapabilities<typeof DeviceType.Ata>,
      ConvertToDevice<typeof DeviceType.Ata>
    >
  > = {
    horizontal: (value: keyof typeof Horizontal) => Horizontal[value],
    thermostat_mode: (value: keyof typeof OperationMode) =>
      OperationMode[value],
    vertical: (value: keyof typeof Vertical) => Vertical[value],
  }

  protected readonly deviceToCapability: Partial<
    Record<
      keyof OperationalCapabilities<typeof DeviceType.Ata>,
      ConvertFromDevice<typeof DeviceType.Ata>
    >
  > = {
    'alarm_generic.silent': (value: FanSpeed) => value === FanSpeed.silent,
    fan_speed: (value: FanSpeed) =>
      value === FanSpeed.silent ? FanSpeed.auto : value,
    horizontal: (value: Horizontal) => horizontalFromDevice[value],
    thermostat_mode: (
      value: OperationMode,
      data: ListDeviceData<typeof DeviceType.Ata>,
    ) => (data.Power ? operationModeFromDevice[value] : ThermostatModeAta.off),
    vertical: (value: Vertical) => verticalFromDevice[value],
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
