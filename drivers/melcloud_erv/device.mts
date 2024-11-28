import {
  VentilationMode,
  type DeviceType,
  type ListDeviceData,
} from '@olivierzal/melcloud-api'

import { ThermostatModeErv } from '../../types/erv.mts'
import { BaseMELCloudDevice } from '../base-device.mts'

import type {
  ConvertFromDevice,
  ConvertToDevice,
  OpCapabilities,
  SetCapabilities,
} from '../../types/common.mts'

export default class MELCloudDeviceErv extends BaseMELCloudDevice<DeviceType.Erv> {
  protected readonly EnergyReportRegular = undefined

  protected readonly EnergyReportTotal = undefined

  protected readonly fromDevice: Partial<
    Record<
      keyof OpCapabilities<DeviceType.Erv>,
      ConvertFromDevice<DeviceType.Erv>
    >
  > = {
    thermostat_mode: ((
      value: VentilationMode,
      data: ListDeviceData<DeviceType.Erv>,
    ) =>
      data.Power ?
        VentilationMode[value]
      : ThermostatModeErv.off) as ConvertFromDevice<DeviceType.Erv>,
  } as const

  protected readonly thermostatMode = ThermostatModeErv

  protected readonly toDevice: Partial<
    Record<
      keyof SetCapabilities<DeviceType.Erv>,
      ConvertToDevice<DeviceType.Erv>
    >
  > = {
    thermostat_mode: ((value: keyof typeof VentilationMode) =>
      VentilationMode[value]) as ConvertToDevice<DeviceType.Erv>,
  } as const
}
