import BaseMELCloudDevice from '../../bases/device'
import type MELCloudDriverErv from './driver'
import type {
  Capability,
  CapabilityValue,
  DeviceValue,
  SetCapability,
  SetDeviceValue,
} from '../../types'

const ventilationModes: readonly string[] = [
  'recovery',
  'bypass',
  'auto',
] as const

export = class MELCloudDeviceErv extends BaseMELCloudDevice {
  // eslint-disable-next-line @typescript-eslint/require-await
  protected async specificOnCapability(
    capability: SetCapability<MELCloudDriverErv>,
    value: CapabilityValue,
  ): Promise<void> {
    this.diff.set(capability, value)
  }

  protected convertToDevice(
    capability: SetCapability<MELCloudDriverErv>,
    value: CapabilityValue,
  ): SetDeviceValue {
    switch (capability) {
      case 'onoff':
        return (this.getSetting('always_on') as boolean)
          ? true
          : (value as boolean)
      case 'ventilation_mode':
        return ventilationModes.indexOf(value as string)
      default:
        return value as SetDeviceValue
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected convertFromDevice(
    capability: Capability<MELCloudDriverErv>,
    value: DeviceValue,
  ): CapabilityValue {
    if (capability === 'ventilation_mode') {
      return ventilationModes[value as number]
    }
    return value
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected async updateThermostatMode(): Promise<void> {
    // Not implemented.
  }
}
