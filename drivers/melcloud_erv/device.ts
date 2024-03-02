import {
  type DeviceData,
  type ListDevice,
  type NonEffectiveFlagsValueOf,
  type SetDeviceData,
  VentilationMode,
} from '../../melcloud/types'
import type { OpCapabilities, SetCapabilities } from '../../types'
import BaseMELCloudDevice from '../../bases/device'

type ConvertFromDevice = (
  value:
    | NonEffectiveFlagsValueOf<DeviceData['Erv']>
    | NonEffectiveFlagsValueOf<ListDevice['Erv']['Device']>,
) => OpCapabilities['Erv'][keyof OpCapabilities['Erv']]

export = class ErvDevice extends BaseMELCloudDevice<'Erv'> {
  protected readonly fromDevice: Partial<
    Record<keyof OpCapabilities['Erv'], ConvertFromDevice>
  > = {
    ventilation_mode: ((value: VentilationMode) =>
      VentilationMode[value]) as ConvertFromDevice,
  }

  protected readonly reportPlanParameters: null = null

  protected convertToDevice<K extends keyof SetCapabilities['Erv']>(
    capability: K,
    value: SetCapabilities['Erv'][K],
  ): NonEffectiveFlagsValueOf<SetDeviceData['Erv']> {
    switch (capability) {
      case 'onoff':
        return this.getSetting('always_on') || (value as boolean)
      case 'ventilation_mode':
        return VentilationMode[value as keyof typeof VentilationMode]
      default:
        return value as NonEffectiveFlagsValueOf<SetDeviceData['Erv']>
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected async specificOnCapability(): Promise<void> {
    // Not implemented
  }
}
