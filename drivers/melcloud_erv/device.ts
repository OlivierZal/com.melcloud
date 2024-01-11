import BaseMELCloudDevice from '../../bases/device'
import type ErvDriver from './driver'
import {
  VentilationMode,
  type Capability,
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

  protected convertToDevice(
    capability: SetCapability<ErvDriver>,
    value: CapabilityValue,
  ): SetDeviceValue {
    switch (capability) {
      case 'onoff':
        return this.getSetting('always_on') === true || (value as boolean)
      case 'ventilation_mode':
        return VentilationMode[value as keyof typeof VentilationMode]
      default:
        return value as SetDeviceValue
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected convertFromDevice(
    capability: Capability<ErvDriver>,
    value: DeviceValue,
  ): CapabilityValue {
    if (capability === 'ventilation_mode') {
      return VentilationMode[value as number]
    }
    return value
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected async updateThermostatMode(): Promise<void> {
    // Not implemented.
  }
}
