import {
  type DeviceDataErv,
  type DeviceDataFromListErv,
  type SetDeviceDataErv,
  VentilationMode,
} from '../../melcloud/types'
import type {
  NonEffectiveFlagsValueOf,
  OpCapabilities,
  SetCapabilitiesErv,
} from '../../types'
import BaseMELCloudDevice from '../../bases/device'
import type ErvDriver from './driver'

export = class ErvDevice extends BaseMELCloudDevice<ErvDriver> {
  protected readonly reportPlanParameters: null = null

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected convertFromDevice<K extends keyof OpCapabilities<ErvDriver>>(
    capability: K,
    value:
      | NonEffectiveFlagsValueOf<DeviceDataErv>
      | NonEffectiveFlagsValueOf<DeviceDataFromListErv>,
  ): OpCapabilities<ErvDriver>[K] {
    return capability === 'ventilation_mode'
      ? (VentilationMode[
          value as VentilationMode
        ] as OpCapabilities<ErvDriver>[K])
      : (value as OpCapabilities<ErvDriver>[K])
  }

  protected convertToDevice<K extends keyof SetCapabilitiesErv>(
    capability: K,
    value: SetCapabilitiesErv[K],
  ): NonEffectiveFlagsValueOf<SetDeviceDataErv> {
    switch (capability) {
      case 'onoff':
        return this.getSetting('always_on') || (value as boolean)
      case 'ventilation_mode':
        return VentilationMode[value as keyof typeof VentilationMode]
      default:
        return value as NonEffectiveFlagsValueOf<SetDeviceDataErv>
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
