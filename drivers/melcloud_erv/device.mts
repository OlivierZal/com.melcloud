import {
  type DeviceType,
  type ListDeviceData,
  VentilationMode,
} from '@olivierzal/melcloud-api'

import type {
  ConvertFromDevice,
  ConvertToDevice,
  OpCapabilities,
  SetCapabilities,
} from '../../types/common.mts'

import { ThermostatModeErv } from '../../types/erv.mts'
import { BaseMELCloudDevice } from '../base-device.mts'

export default class MELCloudDeviceErv extends BaseMELCloudDevice<DeviceType.Erv> {
  protected readonly EnergyReportRegular = null

  protected readonly EnergyReportTotal = null

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
  }

  protected readonly thermostatMode = ThermostatModeErv

  protected readonly toDevice: Partial<
    Record<
      keyof SetCapabilities<DeviceType.Erv>,
      ConvertToDevice<DeviceType.Erv>
    >
  > = {
    thermostat_mode: ((value: keyof typeof VentilationMode) =>
      VentilationMode[value]) as ConvertToDevice<DeviceType.Erv>,
  }
}
