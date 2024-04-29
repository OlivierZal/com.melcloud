import type {
  ConvertFromDevice,
  ConvertToDevice,
  OpCapabilities,
  SetCapabilities,
} from '../../types'
import BaseMELCloudDevice from '../../bases/device'
import { VentilationMode } from 'melcloud'

export = class ErvDevice extends BaseMELCloudDevice<'Erv'> {
  protected readonly fromDevice: Partial<
    Record<keyof OpCapabilities['Erv'], ConvertFromDevice<'Erv'>>
  > = {
    ventilation_mode: ((value: VentilationMode) =>
      VentilationMode[value]) as ConvertFromDevice<'Erv'>,
  }

  protected readonly reportPlanParameters = null

  protected readonly toDevice: Partial<
    Record<keyof SetCapabilities['Erv'], ConvertToDevice<'Erv'>>
  > = {
    ventilation_mode: ((value: keyof typeof VentilationMode) =>
      VentilationMode[value]) as ConvertToDevice<'Erv'>,
  }
}
