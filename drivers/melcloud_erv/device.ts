import {
  type DeviceDataFromList,
  type OpCapabilities,
  type SetCapabilities,
  type SetDeviceData,
  type ValueOf,
  VentilationMode,
} from '../../types'
import BaseMELCloudDevice from '../../bases/device'
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
  ): ValueOf<SetDeviceData<ErvDriver>> {
    switch (capability) {
      case 'onoff':
        return this.getSetting('always_on') || (value as boolean)
      case 'ventilation_mode':
        return VentilationMode[value as keyof typeof VentilationMode]
      default:
        return value as ValueOf<SetDeviceData<ErvDriver>>
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected convertFromDevice<K extends keyof OpCapabilities<ErvDriver>>(
    capability: K,
    value: ValueOf<DeviceDataFromList<ErvDriver>>,
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
