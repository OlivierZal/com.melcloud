import {
  type ListDeviceDataAta,
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
} from '@olivierzal/melcloud-api'

import BaseMELCloudDevice from '../../bases/device'
import {
  type ConvertFromDevice,
  type ConvertToDevice,
  type OpCapabilitiesAta,
  type ReportPlanParameters,
  type SetCapabilitiesAta,
  ThermostatModeAta,
} from '../../types'

export = class extends BaseMELCloudDevice<'Ata'> {
  protected readonly fromDevice: Partial<
    Record<keyof OpCapabilitiesAta, ConvertFromDevice<'Ata'>>
  > = {
    'alarm_generic.silent': ((value: FanSpeed) =>
      value === FanSpeed.silent) as ConvertFromDevice<'Ata'>,
    fan_power: ((value: FanSpeed) =>
      value === FanSpeed.silent ?
        FanSpeed.auto
      : value) as ConvertFromDevice<'Ata'>,
    horizontal: ((value: Horizontal) =>
      Horizontal[value]) as ConvertFromDevice<'Ata'>,
    thermostat_mode: ((value: OperationMode, data: ListDeviceDataAta) =>
      data.Power ?
        OperationMode[value]
      : ThermostatModeAta.off) as ConvertFromDevice<'Ata'>,
    vertical: ((value: Vertical) =>
      Vertical[value]) as ConvertFromDevice<'Ata'>,
  }

  protected readonly reportPlanParameters: ReportPlanParameters = {
    duration: { hours: 1 },
    interval: { hours: 1 },
    minus: { hours: 1 },
    values: { millisecond: 0, minute: 5, second: 0 },
  }

  protected readonly toDevice: Partial<
    Record<keyof SetCapabilitiesAta, ConvertToDevice<'Ata'>>
  > = {
    horizontal: ((value: keyof typeof Horizontal) =>
      Horizontal[value]) as ConvertToDevice<'Ata'>,
    thermostat_mode: ((value: keyof typeof OperationMode) =>
      OperationMode[value]) as ConvertToDevice<'Ata'>,
    vertical: ((value: keyof typeof Vertical) =>
      Vertical[value]) as ConvertToDevice<'Ata'>,
  }
}
