import {
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
  type DeviceType,
  type ListDeviceData,
} from '@olivierzal/melcloud-api'

import { ThermostatModeAta } from '../../types/ata.mts'
import { BaseMELCloudDevice } from '../base-device.mts'

import { EnergyReportRegularAta } from './reports/regular.mts'
import { EnergyReportTotalAta } from './reports/total.mts'

import type {
  ConvertFromDevice,
  ConvertToDevice,
  OpCapabilities,
  SetCapabilities,
} from '../../types/common.mts'

export default class MELCloudDeviceAta extends BaseMELCloudDevice<DeviceType.Ata> {
  protected readonly EnergyReportRegular = EnergyReportRegularAta

  protected readonly EnergyReportTotal = EnergyReportTotalAta

  protected readonly fromDevice: Partial<
    Record<
      keyof OpCapabilities<DeviceType.Ata>,
      ConvertFromDevice<DeviceType.Ata>
    >
  > = {
    'alarm_generic.silent': ((value: FanSpeed) =>
      value === FanSpeed.silent) as ConvertFromDevice<DeviceType.Ata>,
    fan_speed: ((value: FanSpeed) =>
      value === FanSpeed.silent ?
        FanSpeed.auto
      : value) as ConvertFromDevice<DeviceType.Ata>,
    horizontal: ((value: Horizontal) =>
      Horizontal[value]) as ConvertFromDevice<DeviceType.Ata>,
    thermostat_mode: ((
      value: OperationMode,
      data: ListDeviceData<DeviceType.Ata>,
    ) =>
      data.Power ?
        OperationMode[value]
      : ThermostatModeAta.off) as ConvertFromDevice<DeviceType.Ata>,
    vertical: ((value: Vertical) =>
      Vertical[value]) as ConvertFromDevice<DeviceType.Ata>,
  } as const

  protected readonly thermostatMode = ThermostatModeAta

  protected readonly toDevice: Partial<
    Record<
      keyof SetCapabilities<DeviceType.Ata>,
      ConvertToDevice<DeviceType.Ata>
    >
  > = {
    horizontal: ((value: keyof typeof Horizontal) =>
      Horizontal[value]) as ConvertToDevice<DeviceType.Ata>,
    thermostat_mode: ((value: keyof typeof OperationMode) =>
      OperationMode[value]) as ConvertToDevice<DeviceType.Ata>,
    vertical: ((value: keyof typeof Vertical) =>
      Vertical[value]) as ConvertToDevice<DeviceType.Ata>,
  } as const
}
