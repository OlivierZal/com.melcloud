import {
  type ListDeviceDataErv,
  VentilationMode,
} from '@olivierzal/melcloud-api'

import BaseMELCloudDevice from '../../bases/device'
import {
  type ConvertFromDevice,
  type ConvertToDevice,
  type OpCapabilitiesErv,
  type SetCapabilitiesErv,
  ThermostatModeErv,
} from '../../types'

export = class extends BaseMELCloudDevice<'Erv'> {
  protected readonly fromDevice: Partial<
    Record<keyof OpCapabilitiesErv, ConvertFromDevice<'Erv'>>
  > = {
    thermostat_mode: ((value: VentilationMode, data: ListDeviceDataErv) =>
      data.Power ?
        VentilationMode[value]
      : ThermostatModeErv.off) as ConvertFromDevice<'Erv'>,
  }

  protected readonly reportPlanParameters = null

  protected readonly toDevice: Partial<
    Record<keyof SetCapabilitiesErv, ConvertToDevice<'Erv'>>
  > = {
    thermostat_mode: ((value: keyof typeof VentilationMode) =>
      VentilationMode[value]) as ConvertToDevice<'Erv'>,
  }
}
