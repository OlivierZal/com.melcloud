import BaseMELCloudDevice from '../../bases/device'
import type ErvDriver from './driver'
import type {
  Capability,
  CapabilityValue,
  DeviceValue,
  SetCapability,
  SetDeviceValue,
} from '../../types'

enum VentilationModeErv {
  recovery = 0,
  bypass = 1,
  auto = 2,
}

export = class ErvDevice extends BaseMELCloudDevice {
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
        return (this.getSetting('always_on') as boolean)
          ? true
          : (value as boolean)
      case 'ventilation_mode':
        return VentilationModeErv[value as keyof typeof VentilationModeErv]
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
      return VentilationModeErv[value as number]
    }
    return value
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected async updateThermostatMode(): Promise<void> {
    // Not implemented.
  }
}
