import {
  type DeviceType,
  type ListDeviceData,
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
} from '@olivierzal/melcloud-api'

import { keyOfValue } from '../../lib/index.mts'
import {
  type ConvertFromDevice,
  type ConvertToDevice,
  type OpCapabilities,
  type SetCapabilities,
  ThermostatModeAta,
} from '../../types/index.mts'
import { BaseMELCloudDevice } from '../base-device.mts'

import {
  EnergyReportRegularAta,
  EnergyReportTotalAta,
} from './reports/index.mts'

export default class MELCloudDeviceAta extends BaseMELCloudDevice<
  typeof DeviceType.Ata
> {
  protected readonly EnergyReportRegular = EnergyReportRegularAta

  protected readonly EnergyReportTotal = EnergyReportTotalAta

  protected readonly fromDevice: Partial<
    Record<
      keyof OpCapabilities<typeof DeviceType.Ata>,
      ConvertFromDevice<typeof DeviceType.Ata>
    >
  > = {
    'alarm_generic.silent': ((value: FanSpeed) =>
      value === FanSpeed.silent) as ConvertFromDevice<typeof DeviceType.Ata>,
    fan_speed: ((value: FanSpeed) =>
      value === FanSpeed.silent ? FanSpeed.auto : value) as ConvertFromDevice<
      typeof DeviceType.Ata
    >,
    horizontal: ((value: Horizontal) =>
      keyOfValue(Horizontal, value)) as ConvertFromDevice<
      typeof DeviceType.Ata
    >,
    thermostat_mode: ((
      value: OperationMode,
      data: ListDeviceData<typeof DeviceType.Ata>,
    ) =>
      data.Power ?
        keyOfValue(OperationMode, value)
      : ThermostatModeAta.off) as ConvertFromDevice<typeof DeviceType.Ata>,
    vertical: ((value: Vertical) =>
      keyOfValue(Vertical, value)) as ConvertFromDevice<typeof DeviceType.Ata>,
  }

  protected readonly thermostatMode = ThermostatModeAta

  protected readonly toDevice: Partial<
    Record<
      keyof SetCapabilities<typeof DeviceType.Ata>,
      ConvertToDevice<typeof DeviceType.Ata>
    >
  > = {
    horizontal: ((value: keyof typeof Horizontal) =>
      Horizontal[value]) as ConvertToDevice<typeof DeviceType.Ata>,
    thermostat_mode: ((value: keyof typeof OperationMode) =>
      OperationMode[value]) as ConvertToDevice<typeof DeviceType.Ata>,
    vertical: ((value: keyof typeof Vertical) =>
      Vertical[value]) as ConvertToDevice<typeof DeviceType.Ata>,
  }
}
