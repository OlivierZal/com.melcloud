import {
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
  type ListDeviceDataAta,
} from '@olivierzal/melcloud-api'

import { EnergyReportRegularAta } from '../../reports/melcloud/regular.mts'
import { EnergyReportTotalAta } from '../../reports/melcloud/total.mts'
import {
  ThermostatModeAta,
  type ConvertFromDevice,
  type ConvertToDevice,
  type OpCapabilitiesAta,
  type SetCapabilitiesAta,
} from '../../types/index.mts'
import { BaseMELCloudDevice } from '../base-device.mts'

export default class MELCloudDeviceAta extends BaseMELCloudDevice<'Ata'> {
  protected readonly fromDevice: Partial<
    Record<keyof OpCapabilitiesAta, ConvertFromDevice<'Ata'>>
  > = {
    'alarm_generic.silent': ((value: FanSpeed) =>
      value === FanSpeed.silent) as ConvertFromDevice<'Ata'>,
    fan_speed: ((value: FanSpeed) =>
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
  } as const

  protected readonly toDevice: Partial<
    Record<keyof SetCapabilitiesAta, ConvertToDevice<'Ata'>>
  > = {
    horizontal: ((value: keyof typeof Horizontal) =>
      Horizontal[value]) as ConvertToDevice<'Ata'>,
    thermostat_mode: ((value: keyof typeof OperationMode) =>
      OperationMode[value]) as ConvertToDevice<'Ata'>,
    vertical: ((value: keyof typeof Vertical) =>
      Vertical[value]) as ConvertToDevice<'Ata'>,
  } as const

  protected EnergyReportRegular = EnergyReportRegularAta

  protected EnergyReportTotal = EnergyReportTotalAta
}
