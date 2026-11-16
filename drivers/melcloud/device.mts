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

// Both reports run every hour and ask for the day of the hour that just
// closed.
const HOURLY_ENERGY_REPORT = {
  duration: { hours: 1 },
  minus: { hours: 1 },
} satisfies Partial<EnergyReportConfig>

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

  // Five past the hour is a floor, not a preference: MELCloud's figures
  // for the hour that just closed are not there on the hour. The
  // lifetime figure moves within the hour, and `meter_power` is all
  // Homey Energy counts a unit from, credited to the hour of the write:
  // one read a night would book a day the night after, as one bar. So
  // the total is read every hour too, from hh:30 to hh:55: clear of the
  // reads at five past and, in a zone a whole number of hours from UK
  // time, of the minutes after 00:05 there where MELCloud Classic leaves
  // reads unanswered.
  protected override readonly energyReports: EnergyReports = {
    regular: {
      ...HOURLY_ENERGY_REPORT,
      mode: 'regular',
      spread: { minutes: 5 },
      values: { millisecond: 0, minute: 5, second: 0 },
    },
    total: {
      ...HOURLY_ENERGY_REPORT,
      mode: 'total',
      spread: { minutes: 25 },
      values: { millisecond: 0, minute: 30, second: 0 },
    },
    create: (
      config: EnergyReportConfig,
    ): EnergyReport<typeof Classic.DeviceType.Ata> =>
      new EnergyReport(this, config),
  }

  protected override readonly thermostatMode: typeof ThermostatModeAta =
    ThermostatModeAta
}
