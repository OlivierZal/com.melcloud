import {
  VentilationMode,
  type ListDeviceDataErv,
} from '@olivierzal/melcloud-api'

import { BaseMELCloudDevice } from '../../bases/index.mjs'
import {
  ThermostatModeErv,
  type ConvertFromDevice,
  type ConvertToDevice,
  type OpCapabilitiesErv,
  type SetCapabilitiesErv,
} from '../../types/index.mjs'

class MELCloudDeviceErv extends BaseMELCloudDevice<'Erv'> {
  protected readonly fromDevice: Partial<
    Record<keyof OpCapabilitiesErv, ConvertFromDevice<'Erv'>>
  > = {
    thermostat_mode: ((value: VentilationMode, data: ListDeviceDataErv) =>
      data.Power ?
        VentilationMode[value]
      : ThermostatModeErv.off) as ConvertFromDevice<'Erv'>,
  } as const

  protected readonly toDevice: Partial<
    Record<keyof SetCapabilitiesErv, ConvertToDevice<'Erv'>>
  > = {
    thermostat_mode: ((value: keyof typeof VentilationMode) =>
      VentilationMode[value]) as ConvertToDevice<'Erv'>,
  } as const

  protected EnergyReportRegular = undefined

  protected EnergyReportTotal = undefined
}

export default MELCloudDeviceErv
