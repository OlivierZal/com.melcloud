import {
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
  type DeviceType,
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

export default class MELCloudDeviceAta extends BaseMELCloudDevice<DeviceType.Ata> {
  protected readonly fromDevice: Partial<
    Record<keyof OpCapabilitiesAta, ConvertFromDevice<DeviceType.Ata>>
  > = {
    'alarm_generic.silent': ((value: FanSpeed) =>
      value === FanSpeed.silent) as ConvertFromDevice<DeviceType.Ata>,
    fan_speed: ((value: FanSpeed) =>
      value === FanSpeed.silent ?
        FanSpeed.auto
      : value) as ConvertFromDevice<DeviceType.Ata>,
    horizontal: ((value: Horizontal) =>
      Horizontal[value]) as ConvertFromDevice<DeviceType.Ata>,
    thermostat_mode: ((value: OperationMode, data: ListDeviceDataAta) =>
      data.Power ?
        OperationMode[value]
      : ThermostatModeAta.off) as ConvertFromDevice<DeviceType.Ata>,
    vertical: ((value: Vertical) =>
      Vertical[value]) as ConvertFromDevice<DeviceType.Ata>,
  } as const

  protected readonly toDevice: Partial<
    Record<keyof SetCapabilitiesAta, ConvertToDevice<DeviceType.Ata>>
  > = {
    horizontal: ((value: keyof typeof Horizontal) =>
      Horizontal[value]) as ConvertToDevice<DeviceType.Ata>,
    thermostat_mode: ((value: keyof typeof OperationMode) =>
      OperationMode[value]) as ConvertToDevice<DeviceType.Ata>,
    vertical: ((value: keyof typeof Vertical) =>
      Vertical[value]) as ConvertToDevice<DeviceType.Ata>,
  } as const

  protected EnergyReportRegular = EnergyReportRegularAta

  protected EnergyReportTotal = EnergyReportTotalAta
}
