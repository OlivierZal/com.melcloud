import {
  VentilationMode,
  type DeviceType,
  type ListDeviceDataErv,
} from '@olivierzal/melcloud-api'

import {
  ThermostatModeErv,
  type ConvertFromDevice,
  type ConvertToDevice,
  type OpCapabilitiesErv,
  type SetCapabilitiesErv,
} from '../../types/index.mts'
import { BaseMELCloudDevice } from '../base-device.mts'

export default class MELCloudDeviceErv extends BaseMELCloudDevice<DeviceType.Erv> {
  protected readonly fromDevice: Partial<
    Record<keyof OpCapabilitiesErv, ConvertFromDevice<DeviceType.Erv>>
  > = {
    thermostat_mode: ((value: VentilationMode, data: ListDeviceDataErv) =>
      data.Power ?
        VentilationMode[value]
      : ThermostatModeErv.off) as ConvertFromDevice<DeviceType.Erv>,
  } as const

  protected readonly toDevice: Partial<
    Record<keyof SetCapabilitiesErv, ConvertToDevice<DeviceType.Erv>>
  > = {
    thermostat_mode: ((value: keyof typeof VentilationMode) =>
      VentilationMode[value]) as ConvertToDevice<DeviceType.Erv>,
  } as const

  protected EnergyReportRegular = undefined

  protected EnergyReportTotal = undefined
}
