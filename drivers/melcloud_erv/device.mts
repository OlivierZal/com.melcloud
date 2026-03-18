import {
  type DeviceType,
  type ListDeviceData,
  VentilationMode,
} from '@olivierzal/melcloud-api'

import { keyOfValue } from '../../lib/index.mts'
import {
  type ConvertFromDevice,
  type ConvertToDevice,
  type OpCapabilities,
  type SetCapabilities,
  ThermostatModeErv,
} from '../../types/index.mts'
import { BaseMELCloudDevice } from '../base-device.mts'

export default class MELCloudDeviceErv extends BaseMELCloudDevice<
  typeof DeviceType.Erv
> {
  protected readonly EnergyReportRegular = null

  protected readonly EnergyReportTotal = null

  protected readonly fromDevice: Partial<
    Record<
      keyof OpCapabilities<typeof DeviceType.Erv>,
      ConvertFromDevice<typeof DeviceType.Erv>
    >
  > = {
    thermostat_mode: ((
      value: VentilationMode,
      data: ListDeviceData<typeof DeviceType.Erv>,
    ) =>
      data.Power ?
        keyOfValue(VentilationMode, value)
      : ThermostatModeErv.off) as ConvertFromDevice<typeof DeviceType.Erv>,
  }

  protected readonly thermostatMode = ThermostatModeErv

  protected readonly toDevice: Partial<
    Record<
      keyof SetCapabilities<typeof DeviceType.Erv>,
      ConvertToDevice<typeof DeviceType.Erv>
    >
  > = {
    thermostat_mode: ((value: keyof typeof VentilationMode) =>
      VentilationMode[value]) as ConvertToDevice<typeof DeviceType.Erv>,
  }
}
