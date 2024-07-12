import type {
  ConvertFromDevice,
  ConvertToDevice,
  OpCapabilitiesErv,
  SetCapabilitiesErv,
} from '../../types'
import BaseMELCloudDevice from '../../bases/device'
import { VentilationMode } from '@olivierzal/melcloud-api'

export = class extends BaseMELCloudDevice<'Erv'> {
  protected readonly fromDevice: Partial<
    Record<keyof OpCapabilitiesErv, ConvertFromDevice<'Erv'>>
  > = {
    ventilation_mode: ((value: VentilationMode) =>
      VentilationMode[value]) as ConvertFromDevice<'Erv'>,
  }

  protected readonly reportPlanParameters = null

  protected readonly toDevice: Partial<
    Record<keyof SetCapabilitiesErv, ConvertToDevice<'Erv'>>
  > = {
    ventilation_mode: ((value: keyof typeof VentilationMode) =>
      VentilationMode[value]) as ConvertToDevice<'Erv'>,
  }
}
