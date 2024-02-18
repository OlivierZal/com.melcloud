import {
  type DeviceDataFromList,
  type NonEffectiveFlagsValueOf,
  type OpCapabilities,
  type SetCapabilities,
  type SetDeviceData,
  VentilationMode,
} from '../../types/types'
import BaseMELCloudDevice from '../../bases/device'
import type { DeviceData } from '../../types/MELCloudAPITypes'
import type ErvDriver from './driver'

export = class ErvDevice extends BaseMELCloudDevice<ErvDriver> {
  protected readonly reportPlanParameters: null = null

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async specificOnCapability<
    K extends keyof SetCapabilities<ErvDriver>,
  >(capability: K, value: SetCapabilities<ErvDriver>[K]): Promise<void> {
    this.diff.set(capability, value)
  }

  protected convertToDevice<K extends keyof SetCapabilities<ErvDriver>>(
    capability: K,
    value: SetCapabilities<ErvDriver>[K],
  ): NonEffectiveFlagsValueOf<SetDeviceData<ErvDevice>> {
    switch (capability) {
      case 'onoff':
        return this.getSetting('always_on') || (value as boolean)
      case 'ventilation_mode':
        return VentilationMode[value as keyof typeof VentilationMode]
      default:
        return value as NonEffectiveFlagsValueOf<SetDeviceData<ErvDevice>>
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected convertFromDevice<K extends keyof OpCapabilities<ErvDriver>>(
    capability: K,
    value:
      | NonEffectiveFlagsValueOf<DeviceData<ErvDriver['heatPumpType']>>
      | NonEffectiveFlagsValueOf<DeviceDataFromList<ErvDriver>>,
  ): OpCapabilities<ErvDriver>[K] {
    return capability === 'ventilation_mode'
      ? (VentilationMode[
          value as VentilationMode
        ] as OpCapabilities<ErvDriver>[K])
      : (value as OpCapabilities<ErvDriver>[K])
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected async updateThermostatMode(): Promise<void> {
    // Not implemented.
  }
}
