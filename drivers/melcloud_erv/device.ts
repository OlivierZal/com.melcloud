import BaseMELCloudDevice from '../../bases/device'
import type ErvDriver from './driver'
import {
  VentilationMode,
  type Capabilities,
  type SetCapabilities,
  type CapabilityValue,
  type DeviceValue,
  type SetCapability,
  type SetDeviceValue,
} from '../../types'

export = class ErvDevice extends BaseMELCloudDevice<ErvDriver> {
  protected readonly reportPlanParameters: null = null

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async specificOnCapability(
    capability: SetCapability<ErvDriver>,
    value: CapabilityValue,
  ): Promise<void> {
    this.diff.set(capability, value)
  }

  protected convertToDevice<K extends keyof SetCapabilities<ErvDriver>>(
    capability: K,
    value: SetCapabilities<ErvDriver>[K],
  ): SetDeviceValue {
    switch (capability) {
      case 'onoff':
        return this.getSetting('always_on') || (value as boolean)
      case 'ventilation_mode':
        return VentilationMode[value as keyof typeof VentilationMode]
      default:
        return value as SetDeviceValue
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected convertFromDevice<K extends keyof Capabilities<ErvDriver>>(
    capability: K,
    value: DeviceValue,
  ): Capabilities<ErvDriver>[K] {
    if (capability === 'ventilation_mode') {
      return VentilationMode[
        value as VentilationMode
      ] as Capabilities<ErvDriver>[K]
    }
    return value as Capabilities<ErvDriver>[K]
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected async updateThermostatMode(): Promise<void> {
    // Not implemented.
  }
}
