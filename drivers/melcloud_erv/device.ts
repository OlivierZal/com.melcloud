import {
  type DeviceData,
  type DeviceDataFromList,
  type NonEffectiveFlagsValueOf,
  type SetDeviceData,
  VentilationMode,
} from '../../melcloud/types'
import type { OpCapabilities, SetCapabilities } from '../../types'
import BaseMELCloudDevice from '../../bases/device'

export = class ErvDevice extends BaseMELCloudDevice<'Erv'> {
  protected readonly reportPlanParameters: null = null

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected convertFromDevice<K extends keyof OpCapabilities['Erv']>(
    capability: K,
    value:
      | NonEffectiveFlagsValueOf<DeviceData['Erv']>
      | NonEffectiveFlagsValueOf<DeviceDataFromList['Erv']>,
  ): OpCapabilities['Erv'][K] {
    return capability === 'ventilation_mode'
      ? (VentilationMode[value as VentilationMode] as OpCapabilities['Erv'][K])
      : (value as OpCapabilities['Erv'][K])
  }

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

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected async updateThermostatMode(): Promise<void> {
    // Not implemented
  }
}
