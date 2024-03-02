import type {
  ConvertFromDevice,
  ConvertToDevice,
  OpCapabilities,
  SetCapabilities,
} from '../../types'
import BaseMELCloudDevice from '../../bases/device'
import { VentilationMode } from '../../melcloud/types'

export = class ErvDevice extends BaseMELCloudDevice<'Erv'> {
  protected readonly fromDevice: Partial<
    Record<keyof OpCapabilities['Erv'], ConvertFromDevice<'Erv'>>
  > = {
    ventilation_mode: ((value: VentilationMode) =>
      VentilationMode[value]) as ConvertFromDevice<'Erv'>,
  }

  protected readonly reportPlanParameters: null = null

  protected readonly toDevice: Partial<
    Record<keyof SetCapabilities['Erv'], ConvertToDevice<'Erv'>>
  > = {
    onoff: ((value: boolean) =>
      this.getSetting('always_on') || value) as ConvertToDevice<'Erv'>,
    ventilation_mode: ((value: keyof typeof VentilationMode) =>
      VentilationMode[value]) as ConvertToDevice<'Erv'>,
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected async specificOnCapability(): Promise<void> {
    // Not implemented
  }
}
