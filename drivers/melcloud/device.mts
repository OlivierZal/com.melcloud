import * as Classic from '@olivierzal/melcloud-api/classic'

import type {
  ConvertFromDevice,
  ConvertToDevice,
  OperationalCapabilities,
  SetCapabilities,
} from '../../types/classic-capabilities.mts'
import type { EnergyReports } from '../base-device.mts'
import type { EnergyReportConfig } from '../base-report.mts'
import {
  horizontalFromDevice,
  operationModeFromDevice,
  ThermostatModeAta,
  verticalFromDevice,
} from '../../types/ata.mts'
import { ClassicMELCloudDevice } from '../classic-device.mts'
import { EnergyReport } from '../classic-report.mts'

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
    'alarm_generic.silent': ({ FanSpeed: speed }) =>
      speed === Classic.FanSpeed.silent,
    fan_speed: ({ FanSpeed: speed = Classic.FanSpeed.auto }) =>
      speed === Classic.FanSpeed.silent ? Classic.FanSpeed.auto : speed,
    horizontal: ({ VaneHorizontalDirection: direction }) =>
      horizontalFromDevice[direction],
    thermostat_mode: ({ OperationMode: mode, Power: isOn }) =>
      isOn ? operationModeFromDevice[mode] : ThermostatModeAta.off,
    vertical: ({ VaneVerticalDirection: direction }) =>
      verticalFromDevice[direction],
  }

  protected override readonly energyReports: EnergyReports = {
    regular: {
      duration: { hours: 1 },
      minus: { hours: 1 },
      mode: 'regular',
      values: { millisecond: 0, minute: 5, second: 0 },
    },
    total: {
      duration: { days: 1 },
      minus: { hours: 1 },
      mode: 'total',
      values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
    },
    create: (
      config: EnergyReportConfig,
    ): EnergyReport<typeof Classic.DeviceType.Ata> =>
      new EnergyReport(this, config),
  }

  protected override readonly thermostatMode: typeof ThermostatModeAta =
    ThermostatModeAta
}
